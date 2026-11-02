/**
 * 职面通 · 模拟面试 LLM 代理
 * ------------------------------------------------------------------
 * 为什么必须有这一层：站点是公开静态站，浏览器里放 API key 等于公开。
 * 这一层持有 key，只暴露四个业务接口（面试追问 / 面试报告 / 简历优化 / 文件识别），不透传模型名和密钥。
 *
 * 零依赖，Node 18+（用到全局 fetch）。启动：
 *   node server/index.js
 * 环境变量见 server/.env.example
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- 配置
const PORT = Number(process.env.PORT || 8787);
const ROOT = path.resolve(__dirname, '..');
const STATIC = process.env.STATIC_DIR || ROOT;

loadDotEnv(path.join(__dirname, '.env'));

const PROVIDER = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const API_KEY = process.env.LLM_API_KEY || '';
const BASE_URL = (process.env.LLM_BASE_URL || defaultBase(PROVIDER)).replace(/\/+$/, '');
const MODEL = process.env.LLM_MODEL || defaultModel(PROVIDER);

// 面试时前端每轮都要调，这里做两个兜底：单请求超时、并发限流
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 60000);
const MAX_BODY = 1_000_000;
const MAX_UPLOAD = 15 * 1024 * 1024;   // 文件识别（图片/扫描件 PDF）上限 15MB

function defaultBase(p) {
  return {
    openai:    'https://api.openai.com/v1',
    deepseek:  'https://api.deepseek.com',
    moonshot:  'https://api.moonshot.cn/v1',
    zhipu:     'https://open.bigmodel.cn/api/paas/v4',
    qwen:      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    silicon:   'https://api.siliconflow.cn/v1',
    groq:      'https://api.groq.com/openai/v1',
    openrouter:'https://openrouter.ai/api/v1',
    ollama:    'http://127.0.0.1:11434/v1',
  }[p] || 'https://api.openai.com/v1';
}
function defaultModel(p) {
  return {
    openai: 'gpt-4o-mini', deepseek: 'deepseek-flash', moonshot: 'moonshot-v1-8k',
    zhipu: 'glm-4-flash', qwen: 'qwen-plus', silicon: 'Qwen/Qwen2.5-7B-Instruct',
    groq: 'llama-3.1-8b-instant', openrouter: 'openai/gpt-4o-mini', ollama: 'qwen2.5:7b',
  }[p] || 'gpt-4o-mini';
}

function loadDotEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) { /* 没有 .env 就走环境变量 */ }
}

const configured = () => !!(API_KEY || PROVIDER === 'ollama');

// ---------------------------------------------------------------- 限流
let inflight = 0;
const MAX_INFLIGHT = Number(process.env.LLM_MAX_INFLIGHT || 8);

function readBody(req) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > MAX_BODY) { rej(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { res(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { rej(new Error('invalid json')); }
    });
    req.on('error', rej);
  });
}

function readRawBody(req, limit) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > limit) { rej(new Error('文件过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}

const send = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
  });
  res.end(body);
};

// ---------------------------------------------------------------- LLM 调用
async function chat(messages, opts = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    if (PROVIDER === 'anthropic') {
      const r = await fetch(`${BASE_URL}/messages`, {
        method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: opts.maxTokens || 900, system: opts.system, messages: messages.filter(m => m.role !== 'system') }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`上游 ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
      return (j.content || []).map(c => c.text || '').join('').trim();
    }

    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens || 900,
        // OCR 这类纯文本输出不需要 json_object
        ...(opts.json === false ? {} : { response_format: { type: 'json_object' } }),
        // DeepSeek：显式关掉 thinking，否则推理过程会混进输出、破坏「只输出 json」的约束
        ...(PROVIDER === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
        messages: opts.system ? [{ role: 'system', content: opts.system }, ...messages] : messages,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`上游 ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
    return (j.choices?.[0]?.message?.content || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

/** 模型偶尔不守格式，包一层只取 JSON */
function parseJSON(txt) {
  const cleaned = txt.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const a = cleaned.indexOf('{'), b = cleaned.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(cleaned.slice(a, b + 1)); } catch (_) {} }
  throw new Error('模型没有返回 JSON');
}

/** 调一次并解析 JSON；解析失败就用更严格的措辞重试一次 */
async function chatWithJSONRetry(messages, opts) {
  const first = await chat(messages, opts);
  try { return parseJSON(first); } catch (_) {}
  const second = await chat(messages, { ...opts, system: opts.fallbackSystem, temperature: 0.2 });
  return parseJSON(second);   // 还不行就抛给前端，前端会退回规则引擎
}

// ---------------------------------------------------------------- 提示词
const INTERVIEW_SYSTEM = `你是一名严格的中国互联网/传统行业面试官，正在对大学生做模拟面试。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"action":"followup"|"next","text":"你要说的话","rule":1|2|3|4,"signals":{"vague":false,"hasData":false,"offtopic":false,"complete":false}}

【判定规则，按顺序检查，命中即停】
规则1 用户回答笼统、无具体细节（大量"团队/提升/优化/配合"等概括词，没说自己做了什么）→ action="followup"，追问具体行动
规则2 用户提到数据/数字/百分比，但没有说清怎么做到的 → action="followup"，直接引用他说的那个数字，追问实现方法
规则3 用户回答与目标岗位明显无关（说的是别的事、别的人群）→ action="followup"，先拉回到岗位要求上
规则4 用户回答完整（有时间背景、有任务、说自己做了什么、有结果或数字）→ action="next"
另外：用户没作答或只答了一两个字 → action="followup"，温和地请他先开口

【追问写法】
- 必须是真面试官会说的话，1~2 句，口语化，直接，不解释规则
- 不要复述用户的话，不要说"你的回答很好"这类评价
- 追问要往具体处挖：谁做的、哪一步、为什么、当时什么约束
- action="next" 时 text 留空字符串

【你的身份】
岗位：{{JOB}}
岗位考察重点：{{FOCUS}}
{{RESUME}}

这是第 {{QNO}} 题（共 {{TOTAL}} 题），题型：{{QTYPE}}，已追问 {{FOLLOW}} 次。`;

const REPORT_SYSTEM = `你是面试评估助手。阅读整场模拟面试记录，只输出一个 json 对象，不要任何多余文字：

{
  "total": 1-5 的整数,
  "dims": { "pro": 1-5, "logic": 1-5, "com": 1-5, "adapt": 1-5 },
  "perQuestion": [ { "i": 1, "comment": "一句具体的点评，引用他实际说的话", "tags": ["笼统","有数据无过程","跑题","完整"] } ],
  "advice": [ { "t": "6-10字的小标题", "d": "一到两句具体建议" } ],
  "evidence": ["3~4条评分依据，引用具体数字，例如：6题中有4题给出了处理过程"]
}

【四个维度】
pro    专业度：是否说得出这个岗位的核心概念与取舍
logic  逻辑：有没有清晰的先后顺序和因果
com    表达：是否结构清晰、重点突出
adapt  应变：被追问后能不能调整、补充或修正

【评分标准（BARS 五级锚定）】
5 远超岗位要求，有量化成果支撑
4 达到并部分超越岗位要求
3 满足岗位基本要求
2 部分能力有欠缺
1 明显不符合岗位要求

【原则】
- 必须基于记录里真实出现的内容，不要编造
- 没有把握就打 3 分，不要都给 4
- advice 要可执行，3~4 条，最多 4 条
- 语气直接、不客套，像一个靠谱的学长给建议`;

const RESUME_SYSTEM = `你是资深简历顾问，正在把一份求职者简历对照某个岗位 JD 做「改写 + 建议」，不做打分。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"advice":[{"from":"维度名","t":"6-14字小标题","d":"一到两句具体、可执行的建议"}],"personal":"重写后的个人评价（60-140字，一段话）","lines":[{"idx":3,"sec":"work","after":"改写后的整句","notes":["一句话说明改了什么"]}]}

【逐句改写规则】
- 只改「表达」，不改「事实」：不能凭空给经历加数字、加项目、加技能。需要用户自己填的数字用【具体数字】占位，并在 notes 里写"请填真实值"。
- 弱动词升级要克制：「负责」只有上下文能看出是主导时才升成「主导/牵头」，否则用「负责并推进」这类中性说法。
- 有行业术语机会时，把简历里的说法对齐到 JD 的用词（自然带出，不硬塞）。
- 说「我们/团队」的地方，只有在简历能看出个人贡献时才改成「我」，不要编造个人贡献。
- idx 必须原样使用正文列表给的序号；sec 只能是 work/proj/edu/skill/other 之一。
- 只返回你真正改过的句子，没问题的句子不要放进 lines。每条 notes 不超过 15 字。

【个人评价重写规则】
- 删掉「认真负责/积极主动/吃苦耐劳」这类通用修饰。
- 只基于简历里真实出现过的经历、技能、项目，写一段贴合 JD 职责的评价。
- 做不到的事不能写成"我扛过"，不要替候选人吹牛。

【建议规则】
- 给 3~5 条，指向这份简历最该改的问题：缺量化、弱动词、跑题、篇幅失衡、个人评价模板化、JD 关键词缺失。
- from 用一个中文维度名（如"成果可量化性"）；每条建议要具体到"哪一句/哪个点"，不要泛泛而谈。`;

// ---------------------------------------------------------------- 业务接口
async function handleInterview(body) {
  const { job, resume, question, questionType, follow, qno, total, answers } = body;
  if (!question) return { fallback: true, reason: '缺少题目' };

  // 硬性上限：追问第 3 次一律放行，模型说什么都不听
  if (Number(follow) >= 2) return { action: 'next', text: '', rule: 5 };

  const system = INTERVIEW_SYSTEM
    .replace('{{JOB}}', job?.name || '未指定岗位')
    .replace('{{FOCUS}}', job?.focus || '通用能力')
    .replace('{{RESUME}}', resume?.summary
      ? `【候选人简历摘要】${resume.summary}\n出题和追问都要结合这份简历，但不要显得在念简历。`
      : '【候选人简历】未提供，按岗位通用要求提问。')
    .replace('{{QNO}}', qno ?? 1)
    .replace('{{TOTAL}}', total ?? '若干')
    .replace('{{QTYPE}}', questionType || '综合')
    .replace('{{FOLLOW}}', follow ?? 0);

  const msgs = [{ role: 'user', content: `题目：${question}\n\n候选人回答：\n${(answers || []).map((a, i) => `第 ${i + 1} 次回答：${a}`).join('\n') || '（尚未作答）'}` }];

  const raw = await chatWithJSONRetry(msgs, {
    system, temperature: 0.6, maxTokens: 400,
    fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
  });
  const j = raw;

  if (Number(follow) + 1 >= 2 && j.action === 'followup') {
    // 只剩最后一次追问机会了，按模型判断发，但记下来
    return { action: 'followup', text: String(j.text || '').slice(0, 300), rule: Number(j.rule) || 1, signals: j.signals || {} };
  }
  return {
    action: j.action === 'next' ? 'next' : 'followup',
    text: String(j.text || '').slice(0, 300),
    rule: Number(j.rule) || 1,
    signals: j.signals || {},
  };
}

async function handleReport(body) {
  const { job, resume, records } = body;
  if (!records || !records.length) return { fallback: true, reason: '没有作答记录' };

  const digest = records.map((r, i) => {
    const ans = (r.answers || []).map((a, k) => `  第${k + 1}次：${String(a).slice(0, 400)}`).join('\n');
    return `第 ${i + 1} 题【${r.typeName || r.type}】${r.question}\n${ans || '  （未作答）'}`;
  }).join('\n\n');

  const system = REPORT_SYSTEM
    + `\n\n【本次面试】岗位：${job?.name || '未指定'}（${job?.familyLabel || '通用'}）`
    + (resume?.skills?.length ? `\n【简历技能】${resume.skills.slice(0, 12).join('、')}` : '');

  const j = await chatWithJSONRetry([{ role: 'user', content: digest }], {
    system, temperature: 0.3, maxTokens: 1800,
    fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
  });

  const clamp5 = v => Math.max(1, Math.min(5, Math.round(Number(v) || 3)));
  const dims = {
    pro: clamp5(j.dims?.pro), logic: clamp5(j.dims?.logic),
    com: clamp5(j.dims?.com), adapt: clamp5(j.dims?.adapt),
  };
  const total = Math.max(1, Math.min(5, Math.round(
    Number(j.total) || Math.round(dims.pro * .3 + dims.logic * .3 + dims.com * .25 + dims.adapt * .15)
  )));

  return {
    total, dims,
    perQuestion: Array.isArray(j.perQuestion) ? j.perQuestion.slice(0, 40).map(x => ({
      i: Number(x.i) || 0,
      comment: String(x.comment || '').slice(0, 260),
      tags: Array.isArray(x.tags) ? x.tags.slice(0, 4).map(String) : [],
    })) : [],
    advice: Array.isArray(j.advice) ? j.advice.slice(0, 4).map(a => ({
      t: String(a.t || '').slice(0, 24), d: String(a.d || '').slice(0, 300),
    })) : [],
    evidence: Array.isArray(j.evidence) ? j.evidence.slice(0, 5).map(String) : [],
  };
}

// ---------------------------------------------------------------- 简历优化
async function handleResume(body) {
  const { jd, resume } = body;
  if (!jd || !resume) return { fallback: true, reason: '缺少 JD 或简历' };

  const lines = (resume.lines || []).map(l => `${l.idx}|${l.sec}|${String(l.text || '').slice(0, 220)}`);
  const edu = (resume.education || []).map(e => [e.school, e.major, e.degree, e.period].filter(Boolean).join(' ')).slice(0, 2).join('；');
  const exps = (resume.experiences || []).map(e => `${e.title || ''}${e.role ? '（' + e.role + '）' : ''}`).slice(0, 4).join('；');
  const projs = (resume.projects || []).map(p => p.title || '').slice(0, 4).join('；');
  const evalText = (resume.eval || []).join(' ').slice(0, 600);

  const user = [
    `【岗位 JD】\n${String(jd).slice(0, 4000)}`,
    `【简历·教育】${edu || '（未识别）'}`,
    `【简历·经历】${exps || '（无）'}`,
    `【简历·项目】${projs || '（无）'}`,
    `【简历·技能】${(resume.skills || []).slice(0, 14).join('、') || '（未识别）'}`,
    `【个人评价·原文】\n${evalText || '（无个人评价）'}`,
    `【简历正文逐句（格式：序号|区块|原文）】\n${lines.join('\n') || '（无逐句内容）'}`,
  ].join('\n\n');

  const j = await chatWithJSONRetry([{ role: 'user', content: user }], {
    system: RESUME_SYSTEM, temperature: 0.3, maxTokens: 3500,
    fallbackSystem: RESUME_SYSTEM + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
  });

  // 归一化 + 防御：越界、区块不符、空改写的行一律丢弃，前端会再用本地引擎兜底
  const knownSec = new Set(['work', 'proj', 'edu', 'skill', 'other']);
  const maxIdx = (resume.lines || []).length;
  return {
    advice: Array.isArray(j.advice) ? j.advice.slice(0, 5).map(a => ({
      from: String(a.from || '整体').slice(0, 24),
      t: String(a.t || '').slice(0, 24),
      d: String(a.d || '').slice(0, 300),
    })).filter(a => a.t && a.d) : [],
    personal: String(j.personal || '').slice(0, 400),
    lines: Array.isArray(j.lines) ? j.lines.slice(0, 40).map(l => ({
      idx: Number(l.idx),
      sec: String(l.sec || ''),
      after: String(l.after || '').slice(0, 600),
      notes: Array.isArray(l.notes) ? l.notes.slice(0, 4).map(String) : [],
    })).filter(l => knownSec.has(l.sec) && Number.isInteger(l.idx) && l.idx >= 0 && l.idx < maxIdx && l.after) : [],
  };
}

// ---------------------------------------------------------------- 文件识别
async function handleOCR(buf, filename, mime) {
  // 1) 上传文件到上游，拿到 file_id（DeepSeek：purpose=user_data）
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime || 'application/octet-stream' }), filename || 'file');
  form.append('purpose', 'user_data');
  const up = await fetch(`${BASE_URL}/files`, {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}` },
    body: form,
  });
  const uj = await up.json();
  if (!up.ok) throw new Error(`文件上传失败 ${up.status}: ${uj?.error?.message || JSON.stringify(uj).slice(0, 200)}`);
  const fileId = uj.id;
  if (!fileId) throw new Error('文件上传成功但没拿到 file_id');

  // 2) 视觉识别：只吐识别出的正文。json:false 关掉 json_object，thinking 已在上游统一禁用
  const prompt = '请把这张图片或文档里的全部文字原样转录出来（OCR）。只输出识别出的正文，不要解释、不要补充、不要加任何说明；按原文顺序分段，看不清的地方跳过。';
  const text = await chat([{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'file', file_id: fileId },
  ] }], { json: false, temperature: 0, maxTokens: 6000 });

  return { text: String(text || '').trim(), fileId };
}

// ---------------------------------------------------------------- 路由
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    }); return res.end();
  }

  // 探测：前端据此决定走 AI 还是走规则引擎
  if (p === '/api/health') {
    return send(res, 200, {
      ok: true, ai: configured(), provider: configured() ? PROVIDER : null,
      model: configured() ? MODEL : null,
    });
  }

  if (p === '/api/interview' || p === '/api/report' || p === '/api/resume') {
    if (!configured()) return send(res, 503, { error: '服务端未配置 LLM_API_KEY' });
    if (inflight >= MAX_INFLIGHT) return send(res, 429, { error: '并发已满，请稍后' });
    inflight++;
    try {
      const body = await readBody(req);
      const out = p === '/api/interview' ? await handleInterview(body)
        : p === '/api/report' ? await handleReport(body)
        : await handleResume(body);
      return send(res, 200, out);
    } catch (e) {
      const msg = String(e?.message || e);
      const clientish = /abort/i.test(msg) ? '模型响应超时' : msg;
      return send(res, 502, { error: clientish });
    } finally { inflight--; }
  }

  // 文件识别（图片 / 扫描件 PDF）：原始字节直传，元数据走 query
  if (p === '/api/ocr') {
    if (!configured()) return send(res, 503, { error: '服务端未配置 LLM_API_KEY' });
    if (inflight >= MAX_INFLIGHT) return send(res, 429, { error: '并发已满，请稍后' });
    inflight++;
    try {
      const filename = decodeURIComponent(url.searchParams.get('filename') || 'file');
      const mime = decodeURIComponent(url.searchParams.get('mime') || 'application/octet-stream');
      const buf = await readRawBody(req, MAX_UPLOAD);
      if (!buf.length) return send(res, 400, { error: '空文件' });
      return send(res, 200, await handleOCR(buf, filename, mime));
    } catch (e) {
      const msg = String(e?.message || e);
      const clientish = /abort/i.test(msg) ? '模型响应超时' : msg;
      return send(res, 502, { error: clientish });
    } finally { inflight--; }
  }

  // 静态文件
  let f = path.join(STATIC, p === '/' ? 'index.html' : decodeURIComponent(p));
  if (!f.startsWith(STATIC)) { res.writeHead(403); return res.end('forbidden'); }
  try {
    const st = fs.statSync(f);
    if (st.isDirectory()) f = path.join(f, 'index.html');
    const buf = fs.readFileSync(f);
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    return res.end(buf);
  } catch (_) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }
});

server.listen(PORT, () => {
  const tag = configured()
    ? `${PROVIDER} / ${MODEL}`
    : '未配置（前端将回退到规则引擎）';
  console.log(`职面通 LLM 代理已启动  http://127.0.0.1:${PORT}`);
  console.log(`  上游：${tag}`);
  console.log(`  静态目录：${STATIC}`);
  if (!configured()) console.log('  提示：复制 server/.env.example 为 server/.env 并填入 LLM_API_KEY');
});
