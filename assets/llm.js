/* ============================================================
   职面通 · AI 接入层（前端直连 DeepSeek，无后端）
   ------------------------------------------------------------
   ⚠️⚠️ 安全警告 ⚠️⚠️
   下面的 API_KEY 直接写在前端文件里，任何打开本页面的人都能在
   开发者工具里抄走它。这只适合比赛演示 / 一次性 key，用完请去
   DeepSeek 开放平台轮换。正式部署必须改回 server/ 代理模式。

   失败自动回退：任何一步报错，调用方都会退回本地规则引擎。
   ============================================================ */

const LLM = (() => {
  'use strict';

  /* ---------------- 配置（改 key / 模型只动这里） ---------------- */
  const CONFIG = {
    key: 'sk-cb0eca4dd249427a85b2e3166b0e5a85',
    base: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    provider: 'deepseek',
  };

  const TIMEOUT = 60000;
  const state = { ready: true, ai: true, provider: CONFIG.provider, model: CONFIG.model, checked: true };

  /* ============================================================
     底层：直连 DeepSeek 的 chat
     ============================================================ */
  async function chat(messages, opts = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const body = {
        model: CONFIG.model,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens || 900,
        // OCR 这类纯文本输出不需要 json_object
        ...(opts.json === false ? {} : { response_format: { type: 'json_object' } }),
        // DeepSeek：显式关掉 thinking，否则推理过程会混进输出、破坏「只输出 json」的约束
        thinking: { type: 'disabled' },
        messages: opts.system ? [{ role: 'system', content: opts.system }, ...messages] : messages,
      };
      const r = await fetch(`${CONFIG.base}/chat/completions`, {
        method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${CONFIG.key}` },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`上游 ${r.status}: ${j?.error?.message || JSON.stringify(j).slice(0, 200)}`);
      return (j.choices?.[0]?.message?.content || '').trim();
    } finally { clearTimeout(t); }
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
    return parseJSON(second);   // 还不行就抛给调用方，调用方会退回规则引擎
  }

  /* ============================================================
     提示词（与 server/index.js 保持一致）
     ============================================================ */
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

  /* ============================================================
     业务：面试追问
     ============================================================ */
  async function handleInterview(body) {
    const { job, resume, question, questionType, follow, qno, total, answers } = body;
    if (!question) throw new Error('缺少题目');

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

    const j = await chatWithJSONRetry(msgs, {
      system, temperature: 0.6, maxTokens: 400,
      fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });

    if (Number(follow) + 1 >= 2 && j.action === 'followup') {
      return { action: 'followup', text: String(j.text || '').slice(0, 300), rule: Number(j.rule) || 1, signals: j.signals || {} };
    }
    return {
      action: j.action === 'next' ? 'next' : 'followup',
      text: String(j.text || '').slice(0, 300),
      rule: Number(j.rule) || 1,
      signals: j.signals || {},
    };
  }

  /* ============================================================
     业务：面试报告
     ============================================================ */
  async function handleReport(body) {
    const { job, resume, records } = body;
    if (!records || !records.length) throw new Error('没有作答记录');

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

  /* ============================================================
     业务：简历优化（改写 + 建议）
     ============================================================ */
  async function handleResume(body) {
    const { jd, resume } = body;
    if (!jd || !resume) throw new Error('缺少 JD 或简历');

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

  /* ============================================================
     业务：面试出题（AI 按岗位 / 简历生成专属题卷）
     ============================================================ */
  const PAPER_SYSTEM = `你是资深面试官，正在为一名候选人定制一场模拟面试的专属题卷。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"questions":[{"type":"behavior|scenario|pro|culture|stress","t":"题干","hint":"一句话考察点","f":["第一轮追问","第二轮追问"],"d":"专业度|表达|逻辑|应变"}]}

【题型】
behavior 行为题（STAR：情境→任务→行动→结果）
scenario 情景题（场景+约束+决策点）
pro 专业题（岗位核心概念与技能）
culture 文化匹配题（动机、协作、抗挫）
stress 压力题（就事论事、不刁难）

【出题要求】
- 共 {{N}} 道题，题型分布参考：{{PLAN}}
- 岗位：{{JOB}}；考察重点：{{FOCUS}}
- {{RESUME}}
- 题目要具体到这个岗位，不能是放之四海皆准的模板；要能逼出「个人贡献」「量化结果」「真实决策」
- t 是面试官直接说的话，口语化、一次只问一个问题
- hint 一句话点出这题在考察什么；f 是两轮自然追问（追问往「谁做的/哪一步/为什么/当时什么约束」挖）；d 从 专业度/表达/逻辑/应变 里选一个
- 若给了简历，优先从简历里的项目/经历/技能出题、核对其真实性，但不要显得在念简历`;

  async function handlePaper(body) {
    const { job, resume, count } = body;
    if (!job) throw new Error('缺少岗位');
    const PLAN = { 8: { behavior: 2, scenario: 2, pro: 2, culture: 1, stress: 1 }, 12: { behavior: 3, scenario: 3, pro: 3, culture: 2, stress: 1 } };
    const n = Number(count) === 8 ? 8 : 12;
    const plan = PLAN[n];

    const system = PAPER_SYSTEM
      .replace('{{N}}', n)
      .replace('{{PLAN}}', Object.entries(plan).map(([k, v]) => `${k} ${v} 题`).join('、'))
      .replace('{{JOB}}', job.name || '未指定岗位')
      .replace('{{FOCUS}}', job.focus || '通用能力')
      .replace('{{RESUME}}', resume?.summary
        ? `【候选人简历摘要】\n${resume.summary}`
        : '【候选人简历】未提供，按岗位通用要求出题。');

    const j = await chatWithJSONRetry([{ role: 'user', content: `请生成 ${n} 道题。` }], {
      system, temperature: 0.8, maxTokens: 3000,
      fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });

    const validTypes = new Set(['behavior', 'scenario', 'pro', 'culture', 'stress']);
    const validDims = new Set(['专业度', '表达', '逻辑', '应变']);
    const questions = (Array.isArray(j.questions) ? j.questions : [])
      .slice(0, n)
      .map(q => ({
        type: validTypes.has(q.type) ? q.type : 'behavior',
        t: String(q.t || '').slice(0, 200),
        hint: String(q.hint || '').slice(0, 60),
        f: Array.isArray(q.f) ? q.f.slice(0, 2).map(String) : [],
        d: validDims.has(q.d) ? q.d : '逻辑',
      }))
      .filter(q => q.t);

    if (!questions.length) throw new Error('AI 没有返回有效题目');
    return { questions };
  }

  /* ============================================================
     业务：文件 OCR（图片 / 扫描件 PDF → 文字）
     ============================================================ */
  async function handleOCR(file, filename, mime) {
    // 1) 上传文件，拿 file_id（DeepSeek：purpose=user_data）
    const form = new FormData();
    form.append('file', file, filename || file.name || 'file');
    form.append('purpose', 'user_data');
    const up = await fetch(`${CONFIG.base}/files`, {
      method: 'POST',
      headers: { authorization: `Bearer ${CONFIG.key}` },
      body: form,
    });
    const uj = await up.json().catch(() => ({}));
    if (!up.ok) throw new Error(`文件上传失败 ${up.status}: ${uj?.error?.message || JSON.stringify(uj).slice(0, 200)}`);
    const fileId = uj.id;
    if (!fileId) throw new Error('文件上传成功但没拿到 file_id');

    // 2) 视觉识别：只吐识别出的正文
    const prompt = '请把这张图片或文档里的全部文字原样转录出来（OCR）。只输出识别出的正文，不要解释、不要补充、不要加任何说明；按原文顺序分段，看不清的地方跳过。';
    const text = await chat([{ role: 'user', content: [
      { type: 'text', text: prompt },
      { type: 'file', file_id: fileId },
    ] }], { json: false, temperature: 0, maxTokens: 6000 });

    return { text: String(text || '').trim(), fileId };
  }

  /* ============================================================
     业务：成长中心（AI 阅读历史记录给建议）
     ============================================================ */
  const GROWTH_SYSTEM = `你是求职面试教练，正在阅读一名候选人多次模拟面试的历史记录，给出成长建议。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"advice":[{"level":"warn|good|info","tag":"4-8字标签","t":"一句话结论","why":"用数据说明为什么这么判断","act":"一条具体可执行的行动"}]}

【评分口径】
- total 与 dims（pro 专业度 / logic 逻辑 / com 表达 / adapt 应变）都是 1~5 分
- codes 是逐题判定标签：vague 过于笼统、data 有数据无过程、offtopic 答非所问、thin 信息不足、empty 空回答、complete 回答完整

【建议要求】
- 给 3~5 条，按重要度排序
- 每条 why 必须引用记录里的真实数据（例如「最近 3 次平均 3.2 分」「专业度连续两次只有 2 分」「6 次里 4 次出现 vague」）
- act 要可执行、落到具体动作；level 用 warn（要补）/ good（保持）/ info（提醒）
- 语气像一个靠谱的学长，直接、不客套、不堆砌空话`;

  async function handleGrowth(body) {
    const { records } = body;
    if (!Array.isArray(records) || !records.length) throw new Error('没有成长记录');

    const digest = records.map((r, i) => {
      const d = new Date(r.at);
      const ds = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
      const dims = r.dims || {};
      return `第${i + 1}次 ${ds} ${r.role || '未知岗位'} 总分${r.total} 专业${dims.pro || '?'}/逻辑${dims.logic || '?'}/表达${dims.com || '?'}/应变${dims.adapt || '?'} 答${r.answered}题 跳过${r.skipped || 0}题 标签[${(r.codes || []).join(',') || '无'}]`;
    }).join('\n');

    const j = await chatWithJSONRetry([{ role: 'user', content: digest }], {
      system: GROWTH_SYSTEM, temperature: 0.4, maxTokens: 1600,
      fallbackSystem: GROWTH_SYSTEM + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });

    const advice = (Array.isArray(j.advice) ? j.advice : []).slice(0, 5).map(a => ({
      level: ['warn', 'good', 'info'].includes(a.level) ? a.level : 'info',
      tag: String(a.tag || '建议').slice(0, 12),
      t: String(a.t || '').slice(0, 40),
      why: String(a.why || '').slice(0, 200),
      act: String(a.act || '').slice(0, 200),
    })).filter(a => a.t && a.act);

    return { advice };
  }

  /* ============================================================
     业务：模拟答辩（出题 / 追问 / 报告，全部答辩语境）
     ============================================================ */
  const DEFENSE_PAPER_SYSTEM = `你是高校答辩委员会成员，正在为一名学生的论文/课题答辩准备提问。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"questions":[{"type":"behavior|scenario|pro|culture|stress","t":"问题","hint":"一句话考察点","f":["第一轮追问","第二轮追问"],"d":"研究理解|逻辑|表达|应变"}]}

【题型（答辩语境）】
behavior 研究背景与动机（为什么做这个题、背景是什么）
scenario 方法抉择（为什么用这个方法、过程中有什么取舍）
pro 专业知识（研究方法、理论、技术细节）
culture 学术态度（独立性、严谨性、学术规范）
stress 质疑与局限（研究有什么不足、如何回应质疑）

【出题要求】
- 共 {{N}} 道，题型分布参考：{{PLAN}}
- 论文：{{TITLE}}
- {{MATERIAL}}
- 问题要围绕这篇论文的具体内容，不能问放之四海皆准的套话；要能检验「是不是真做、有没有真懂」
- t 口语化、一次只问一个问题；hint 一句话点出考察点；f 是两轮追问；d 从 研究理解/逻辑/表达/应变 里选一个`;

  const DEFENSE_NEXT_SYSTEM = `你是高校答辩委员会成员，正在对一名学生的论文答辩进行追问。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"action":"followup"|"next","text":"你要说的话","rule":1|2|3|4,"signals":{"vague":false,"hasData":false,"offtopic":false,"complete":false}}

【判定规则，按顺序检查，命中即停】
规则1 回答笼统、无具体细节 → followup，追问具体做了什么/怎么做的
规则2 提到数据/结果但没有过程 → followup，追问方法或实验怎么支撑这个结论
规则3 回答与论文无关、或明显不懂装懂 → followup，拉回论文本身
规则4 回答完整（有依据、有过程、有结论）→ next
另外：没作答或只答一两字 → followup，温和请他先开口

【身份】
论文：{{TITLE}}
{{MATERIAL}}
这是第 {{QNO}} 个问题（共 {{TOTAL}} 个），题型 {{QTYPE}}，已追问 {{FOLLOW}} 次。

追问写法：1~2 句，口语化，直接，不评价，往「为什么 / 怎么验证 / 有什么依据 / 局限是什么」挖；action=next 时 text 留空。`;

  const DEFENSE_REPORT_SYSTEM = `你是高校答辩评委。阅读整场模拟答辩记录，只输出一个 json 对象，不要任何多余文字：
{
  "total": 1-5 的整数,
  "dims": { "pro": 1-5, "logic": 1-5, "com": 1-5, "adapt": 1-5 },
  "perQuestion": [ { "i": 1, "comment": "一句话点评", "tags": ["笼统","有数据无过程","跑题","完整"] } ],
  "advice": [ { "t": "6-10字小标题", "d": "一到两句具体建议" } ],
  "evidence": ["3~4条评分依据，引用具体数据"]
}

【四个维度】
pro    研究理解：对论文的研究问题、方法、结论是否真懂
logic  逻辑：论证是否清晰、因果是否成立
com    表达：是否条理清楚、重点突出
adapt  应变：被追问后能否调整、补充、回应质疑

【评分标准（BARS 五级锚定）】
5 远超预期，有证据/量化支撑
4 达到并部分超越
3 基本合格
2 有欠缺
1 明显不懂

【原则】
- 必须基于记录里真实出现的内容，不要编造
- 没有把握就打 3 分
- advice 3~4 条、可执行，语气像严格的导师、直接不客套`;

  async function handleDefensePaper(body) {
    const { thesis, count } = body;
    if (!thesis) throw new Error('缺少论文材料');
    const PLAN = { 8: { behavior: 2, scenario: 2, pro: 2, culture: 1, stress: 1 }, 12: { behavior: 3, scenario: 3, pro: 3, culture: 2, stress: 1 } };
    const n = Number(count) === 8 ? 8 : 12;
    const plan = PLAN[n];
    const system = DEFENSE_PAPER_SYSTEM
      .replace('{{N}}', n)
      .replace('{{PLAN}}', Object.entries(plan).map(([k, v]) => `${k} ${v} 题`).join('、'))
      .replace('{{TITLE}}', thesis.title || '未命名论文')
      .replace('{{MATERIAL}}', thesis.summary ? `【论文内容摘要】\n${thesis.summary}` : '【论文内容】未提供，按通用答辩要求提问。');
    const j = await chatWithJSONRetry([{ role: 'user', content: `请生成 ${n} 个答辩问题。` }], {
      system, temperature: 0.8, maxTokens: 3000,
      fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });
    const validTypes = new Set(['behavior', 'scenario', 'pro', 'culture', 'stress']);
    const validDims = new Set(['研究理解', '逻辑', '表达', '应变']);
    const questions = (Array.isArray(j.questions) ? j.questions : [])
      .slice(0, n)
      .map(q => ({
        type: validTypes.has(q.type) ? q.type : 'behavior',
        t: String(q.t || '').slice(0, 200),
        hint: String(q.hint || '').slice(0, 60),
        f: Array.isArray(q.f) ? q.f.slice(0, 2).map(String) : [],
        d: validDims.has(q.d) ? q.d : '逻辑',
      }))
      .filter(q => q.t);
    if (!questions.length) throw new Error('AI 没有返回有效问题');
    return { questions };
  }

  async function handleDefenseNext(body) {
    const { thesis, question, questionType, follow, qno, total, answers } = body;
    if (!question) throw new Error('缺少问题');
    if (Number(follow) >= 2) return { action: 'next', text: '', rule: 5 };
    const system = DEFENSE_NEXT_SYSTEM
      .replace('{{TITLE}}', thesis?.title || '未命名论文')
      .replace('{{MATERIAL}}', thesis?.summary ? `【论文内容摘要】${thesis.summary}` : '【论文内容】未提供，按通用答辩要求追问。')
      .replace('{{QNO}}', qno ?? 1)
      .replace('{{TOTAL}}', total ?? '若干')
      .replace('{{QTYPE}}', questionType || '综合')
      .replace('{{FOLLOW}}', follow ?? 0);
    const msgs = [{ role: 'user', content: `问题：${question}\n\n学生回答：\n${(answers || []).map((a, i) => `第 ${i + 1} 次回答：${a}`).join('\n') || '（尚未作答）'}` }];
    const j = await chatWithJSONRetry(msgs, {
      system, temperature: 0.6, maxTokens: 400,
      fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });
    if (Number(follow) + 1 >= 2 && j.action === 'followup') {
      return { action: 'followup', text: String(j.text || '').slice(0, 300), rule: Number(j.rule) || 1, signals: j.signals || {} };
    }
    return {
      action: j.action === 'next' ? 'next' : 'followup',
      text: String(j.text || '').slice(0, 300),
      rule: Number(j.rule) || 1,
      signals: j.signals || {},
    };
  }

  async function handleDefenseReport(body) {
    const { thesis, records } = body;
    if (!records || !records.length) throw new Error('没有答辩记录');
    const digest = records.map((r, i) => {
      const ans = (r.answers || []).map((a, k) => `  第${k + 1}次：${String(a).slice(0, 400)}`).join('\n');
      return `第 ${i + 1} 题【${r.typeName || r.type}】${r.question}\n${ans || '  （未作答）'}`;
    }).join('\n\n');
    const system = DEFENSE_REPORT_SYSTEM
      + `\n\n【本次答辩】论文：${thesis?.title || '未命名'}`
      + (thesis?.summary ? `\n【论文摘要】${thesis.summary.slice(0, 600)}` : '');
    const j = await chatWithJSONRetry([{ role: 'user', content: digest }], {
      system, temperature: 0.3, maxTokens: 1800,
      fallbackSystem: system + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });
    const clamp5 = v => Math.max(1, Math.min(5, Math.round(Number(v) || 3)));
    const dims = { pro: clamp5(j.dims?.pro), logic: clamp5(j.dims?.logic), com: clamp5(j.dims?.com), adapt: clamp5(j.dims?.adapt) };
    const total = Math.max(1, Math.min(5, Math.round(Number(j.total) || Math.round(dims.pro * .3 + dims.logic * .3 + dims.com * .25 + dims.adapt * .15))));
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

  /* ============================================================
     业务：表达与副语言点评（语音回答后给定性评价）
     ============================================================ */
  const PARALINGUISTIC_SYSTEM = `你是面试/答辩表达教练，正在点评一名候选人语音回答时的口语表达与副语言表现。

【铁律】只输出一个 json 对象，不要任何多余文字、不要代码块围栏：
{"comment":"一段 60~120 字的定性点评"}

【指标口径】
rate 语速（字/分钟，中文正常约 180~260）；pauses 停顿次数；avgPause 平均停顿时长（毫秒）；fillers 填充词次数；volumeStability 音量稳定度（0~100，越高越稳）

【点评要求】
- 结合给出的对话内容和指标，指出 1~2 个最明显的表达/副语言问题，再给 1 条可执行建议
- 语气直接、不客套；不要复述指标数字本身，要说它意味着什么（例如「语速明显偏快，听起来像在赶，评委会觉得你准备不够从容」）`;

  async function handleParalinguistic(body) {
    const { transcript, metrics } = body;
    if (!transcript && !metrics) throw new Error('缺少表达数据');
    const m = metrics || {};
    const user = [
      `【对话内容】\n${String(transcript || '').slice(0, 1500) || '（无转写）'}`,
      `【副语言指标】语速 ${m.rate ?? '?'} 字/分、停顿 ${m.pauses ?? '?'} 次、平均停顿时长 ${m.avgPause ?? '?'}ms、填充词 ${m.fillers ?? '?'} 次、音量稳定度 ${m.volumeStability ?? '?'}%`,
    ].join('\n\n');
    const j = await chatWithJSONRetry([{ role: 'user', content: user }], {
      system: PARALINGUISTIC_SYSTEM, temperature: 0.4, maxTokens: 600,
      fallbackSystem: PARALINGUISTIC_SYSTEM + '\n\n【再次强调】上一次输出无法被解析。这次只输出一个 json 对象，第一个字符必须是 {，最后一个字符必须是 }。',
    });
    return { comment: String(j.comment || '').slice(0, 400) };
  }

  /* ============================================================
     公开接口（保持与原 LLM 模块一致，调用方无需改动）
     ============================================================ */
  async function probe() {
    return state;
  }
  const next = (p) => handleInterview(p);
  const report = (p) => handleReport(p);
  const resume = (p) => handleResume(p);
  const ocr = (file, filename, mime) => handleOCR(file, filename, mime);
  const paper = (p) => handlePaper(p);
  const growth = (p) => handleGrowth(p);
  const defensePaper = (p) => handleDefensePaper(p);
  const defenseNext = (p) => handleDefenseNext(p);
  const defenseReport = (p) => handleDefenseReport(p);
  const paralinguistic = (p) => handleParalinguistic(p);
  const label = () => `AI 模式 · ${CONFIG.provider}/${CONFIG.model}`;

  return { probe, next, report, resume, ocr, paper, growth, defensePaper, defenseNext, defenseReport, paralinguistic, label, state };
})();

window.LLM = LLM;
