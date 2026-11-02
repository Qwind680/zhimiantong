/* ============================================================
   职面通 · 模拟答辩
   ------------------------------------------------------------
   与模拟面试同一套引擎：上传论文/材料 → 文字或语音两种回答方式，
   AI 答辩委员会出题、追问、出报告。UI 复用 interview.css。
   ============================================================ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const KEY = 'zt-defense-v1';
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 题型（答辩语境） ---------- */
const TYPES = {
  behavior: { label: '研究背景', abbr: '背景题', method: '研究动机 · 背景 · 为什么做这个题' },
  scenario: { label: '方法抉择', abbr: '方法题', method: '方法选择 · 取舍 · 怎么做' },
  pro:      { label: '专业知识', abbr: '专业题', method: '研究方法 · 理论 · 技术细节' },
  culture:  { label: '学术态度', abbr: '态度题', method: '学术规范 · 独立性 · 严谨性' },
  stress:   { label: '质疑局限', abbr: '质疑题', method: '回应质疑 · 局限 · 展望' },
};

/* ---------- 1. 信号词典 ---------- */
const PROC = ['首先','然后','接着','之后','最后','第一步','第二步','第三步','于是','所以','因此','因为','为了',
              '具体','做法','方案','步骤','流程','拆解','梳理','复盘','排查','定位','当时','后来','判断','对齐',
              '先','再','从','把','通过'];
const VAGUE = ['团队','大家','我们','多方面','认真','积极','努力','提升','优化','加强','配合','协助',
               '不断','更加','尽力','尽量','尽可能','负责','完成','做好','各位','相关'];
const TRANSFER = ['沟通','协作','抗压','学习','复盘','责任心','细心','总结','计划','目标','协调','表达','经验','主动','学习能力'];

/* ---------- 2. 回答分析器 ---------- */
function analyze(text, keywords) {
  const t = (text || '').trim();
  const len = t.length;
  const numHit  = t.match(/\d+(?:\.\d+)?\s*%?/);
  const hasNum  = !!numHit || /一半|翻倍|倍/.test(t);
  const procHit = PROC.filter(w => t.includes(w));
  const vagueHit= VAGUE.filter(w => t.includes(w));
  const relHit  = keywords.filter(k => t.includes(k));
  const trHit   = TRANSFER.filter(w => t.includes(w));
  const self    = /我/.test(t);
  const onlyWe  = /我们|团队|部门/.test(t) && !/我(?!们)/.test(t);
  const sents   = t.split(/[。！？!?；;\n]/).filter(x => x.trim()).length;
  const s = { len, hasNum, num: numHit ? numHit[0] : null, raw: t, procN: procHit.length, procHit,
    vagueN: vagueHit.length, vagueHit, relN: relHit.length, relHit, trN: trHit.length, self, onlyWe, sents };
  let code;
  if (len < 4)                                              code = 'empty';
  else if (s.relN === 0 && s.trN === 0 && s.vagueN === 0 && len < 30) code = 'offtopic';
  else if (s.hasNum && s.procN === 0)                       code = 'data';
  else if (s.onlyWe || (s.vagueN >= 2 && s.procN === 0) || (len < 24 && s.procN === 0 && s.relN === 0)) code = 'vague';
  else if (s.procN >= 1 && s.self && (s.hasNum || s.relN > 0 || s.len >= 45)) code = 'complete';
  else                                                      code = 'thin';
  return { s, code };
}

const RULE_TAG = { empty: '空回答', offtopic: '答非所问', data: '有数据无过程', vague: '过于笼统', thin: '信息不足', complete: '回答完整' };

/* ---------- 3. 追问生成（答辩语境） ---------- */
const OFFTOPIC_PULL = [
  () => `这个问题问的是你的论文本身。你说的和论文关联不大，能回到论文上重新讲一遍吗？`,
  () => `我先拉回来——答辩考的是你有没有真做、有没有真懂。结合你的论文说说这一点。`,
  () => `这个回答有点偏题了。我们回到你的研究上来。`,
];
const VAGUE_STAR = {
  behavior: (s) => `你刚才说得比较笼统。具体说说：这个选题的背景里，最关键的矛盾或空白是什么？`,
  scenario: () => '如果重做一遍，你会换掉哪个方法？为什么当时选了现在这个？',
  pro:      () => '能展开讲讲吗？这个方法的原理是什么，你在论文里是怎么实现的？',
  culture:  () => '这部分具体是你自己完成的，还是参考了别人的工作？独立性体现在哪？',
  stress:   () => '这一点确实值得质疑。你论文里是怎么回应这个局限的？',
};
const THIN_PUSH = {
  behavior: () => '再多说一层：你的研究问题是怎么一步步收敛到今天这个题目的？',
  scenario: () => '你用什么依据判断这个方法比别的更合适？',
  pro:      () => '再往下挖一层：这个结论是怎么从你的实验/数据里推出来的？',
  culture:  () => '有没有更具体的一次经历，能说明你独立解决了这个问题？',
  stress:   () => '如果评委追问数据的可靠性，你怎么证明它不是偶然？',
};
const REVERSE = [
  '换个角度：如果这项研究重来一次，你最想改掉哪一步？',
  '最后一个点：你这项工作的贡献，用一句话说清楚它到底新在哪？',
  '补一个反面：如果你的核心结论不成立，会是什么原因导致的？',
];

function makeFollowUp(q, a, keywords, idx) {
  const s = a.s;
  if (a.code === 'offtopic') return { text: OFFTOPIC_PULL[idx % OFFTOPIC_PULL.length](), rule: 3 };
  if (a.code === 'data') return { text: `你提到「${s.num || '这个数据'}」，它是怎么得到、怎么验证的？中间做了什么？`, rule: 2 };
  if (a.code === 'empty') return { text: '你还没有作答。这个问题围绕你的论文，想到哪说到哪，先开口。', rule: 1 };
  if (idx >= 2) return null;
  if (idx === 1) return { text: q.f && q.f[1] ? q.f[1] : REVERSE[1], rule: 1 };
  if (a.code === 'vague') return { text: (VAGUE_STAR[q.type] || VAGUE_STAR.behavior)(s), rule: 1 };
  if (a.code === 'thin') return { text: (THIN_PUSH[q.type] || THIN_PUSH.behavior)(), rule: 1 };
  return { text: q.f && q.f[0] ? q.f[0] : REVERSE[0], rule: 1 };
}

/* ---------- 4. 评分（BARS 五级锚定，答辩维度） ---------- */
const BARS = {
  pro: { name: '研究理解', dim: '研究理解', bars: {
    5: '对研究问题、方法、结论有清晰且准确的理解，能主动点出边界',
    4: '能讲清研究思路，方法结论经得起追问',
    3: '对论文基本理解，但关键处讲不深',
    2: '概念模糊，停留在复述论文层面',
    1: '对论文明显不熟，答非所问',
  } },
  logic: { name: '逻辑', dim: '逻辑', bars: {
    5: '论证链完整，能说清为什么、依据什么、有何局限',
    4: '有因果和先后，能解释关键决策',
    3: '有大致脉络，个别环节跳步',
    2: '想到哪说到哪，缺少推导',
    1: '没有可跟随的逻辑',
  } },
  com: { name: '表达', dim: '表达', bars: {
    5: '条理清楚、重点突出，能主动收敛到结论',
    4: '能讲清一件事，结构基本完整',
    3: '能表达完整，但重点不突出',
    2: '表达零散，需要反复确认',
    1: '难以让人理解在说什么',
  } },
  adapt: { name: '应变', dim: '应变', bars: {
    5: '被质疑后能调整、补充，承认不足并给出新依据',
    4: '追问后能补上细节或修正判断',
    3: '追问后能继续作答，但补充有限',
    2: '追问后基本重复原答案',
    1: '无法应对追问，答非所问反复',
  } },
};
const clamp01 = v => Math.max(0, Math.min(1, v));
const to5 = v => v >= 0.85 ? 5 : v >= 0.68 ? 4 : v >= 0.48 ? 3 : v >= 0.28 ? 2 : 1;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

function scoreRun(state) {
  const recs = state.records.filter(r => r.answers.length);
  if (!recs.length) return { total: 1, dims: { pro: 1, com: 1, logic: 1, adapt: 1 }, evidence: ['这一轮没有留下有效回答。'] };
  const all = (r) => r.answers.map(a => a.s);
  const avgRel = r => avg(all(r).map(s => s.relN));
  const avgProc = r => avg(all(r).map(s => s.procN));
  const avgLen = r => avg(all(r).map(s => s.len));
  const avgSent = r => avg(all(r).map(s => s.sents));
  const selfR = r => all(r).filter(s => s.self).length / all(r).length;
  const proR = recs.map(r => clamp01(avgRel(r) * 0.5 + avgProc(r) * 0.16 + (avgLen(r) >= 45 ? 0.3 : 0)));
  const logicR = recs.map(r => clamp01(avgProc(r) / 2.6));
  const comR = recs.map(r => clamp01((avgSent(r) >= 2 ? 0.45 : 0.2) + (avgLen(r) >= 25 && avgLen(r) <= 220 ? 0.4 : 0.12) + (selfR(r) > 0.5 ? 0.15 : 0)));
  const adaptR = recs.map(r => {
    if (!r.followAnswers.length) return 0.42;
    const gain = avg(r.followAnswers.map(a => (a.procN / 2.6) + (a.len >= 45 ? 0.35 : 0) + (a.relN * 0.2)));
    const base = (r.first.procN / 2.6) + (r.first.len >= 45 ? 0.35 : 0);
    return clamp01(0.5 + (gain - base) * 0.6);
  });
  const raw = { pro: avg(proR), logic: avg(logicR), com: avg(comR), adapt: avg(adaptR) };
  const dims = { pro: to5(raw.pro), com: to5(raw.com), logic: to5(raw.logic), adapt: to5(raw.adapt) };
  const total = Math.round(dims.pro * 0.3 + dims.logic * 0.3 + dims.com * 0.25 + dims.adapt * 0.15);
  const cnt = (c) => recs.filter(c).length;
  const evidence = [
    `${recs.length} 题中有 ${cnt(r => avgProc(r) > 0)} 题给出了完整推导过程`,
    `论文关键词平均命中 ${avg(recs.map(avgRel)).toFixed(1)} 个 / 题`,
    `每次作答平均 ${Math.round(avg(recs.map(avgLen)))} 字`,
    `触发追问 ${recs.filter(r => r.followAnswers.length).length} 次，其中 ${cnt(r => r.followAnswers.some(a => a.procN > r.first.procN))} 次补充出了新细节`,
  ];
  return { total, dims, raw, evidence };
}

/* ---------- 5. 逐题点评 + 建议 ---------- */
const NOTE = {
  offtopic: '回答和论文的关联较弱，评委会把话题拉回论文——这本身就是扣分点。',
  data: '给了数据/结论但没给推导过程，评委会追问「怎么得到、怎么验证」。',
  vague: '用了概括性表述，没有落到研究的具体动作上。',
  thin: '信息量偏少，评委会靠追问替你补。',
  empty: '这题没有作答。',
  complete: '结构完整、有依据有过程，可以再补一个明确的局限或边界。',
};
function noteFor(r) {
  const flags = [...new Set(r.answers.map(a => a.code))];
  return flags.map(c => NOTE[c]).filter(Boolean);
}
function advise(state, sc) {
  const out = [];
  const weak = Object.entries(sc.dims).sort((a, b) => a[1] - b[1])[0];
  const bestOf = (r) => {
    const all = r.answers.map(a => a.s);
    return { relN: avg(all.map(s => s.relN)), procN: avg(all.map(s => s.procN)), hasNum: all.some(s => s.hasNum), len: avg(all.map(s => s.len)) };
  };
  const recs = state.records.filter(r => r.answers.length);
  const weakRel = recs.filter(r => bestOf(r).relN < 0.5).length;
  const vagueN = recs.filter(r => r.answers.some(a => a.code === 'vague' || a.code === 'data')).length;
  const noNum = recs.filter(r => !bestOf(r).hasNum).length;
  const noProc = recs.filter(r => bestOf(r).procN === 0).length;
  if (weak) {
    const B = BARS[weak[0]];
    out.push({ t: `优先补「${B.name}」`, d: `这轮拿到 ${weak[1]} 分，锚点是「${B.bars[weak[1]]}」。下一分要往「${B.bars[Math.min(5, weak[1] + 1)]}」靠。` });
  }
  if (noProc > 0) out.push({ t: '先说依据，再说结论', d: `${noProc} 题里最好的那次回答也没有推导过程。评委会追问的就是「为什么、怎么验证、依据是什么」，这条不补上，其他都白搭。` });
  if (weakRel > 0) out.push({ t: '每题都回到论文', d: `${weakRel} 题没命中论文相关关键词。答之前先问自己：这和我的研究有什么关系？` });
  if (noNum > 0) out.push({ t: '结论要带证据', d: `${noNum} 题的回答里没有量化/证据支撑。哪怕是一个数据、一张图、一次实验结果，也比形容词有用。` });
  if (vagueN > 0) out.push({ t: '把「我们」改成「我做的」', d: `${vagueN} 题出现了概括性表述。答辩最怕的就是说不清「哪部分是你自己做的」。` });
  if (out.length < 2) out.push({ t: '练清「研究叙事」', d: '按 背景 → 问题 → 方法 → 结果 → 局限 的顺序说，尤其别漏掉「局限」，那是评委会重点追问的地方。' });
  return out.slice(0, 4);
}

/* ============================================================
   页面逻辑
   ============================================================ */
const state = {
  step: 1,
  answerMode: 'text',
  title: '',
  material: '',     // 论文/材料全文（解析出的文本）
  materialCtx: null,
  keywords: [],
  paper: [],
  idx: 0,
  follow: 0,
  records: [],
  skipped: 0,
  runId: null,
};

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify({
    step: state.step, answerMode: state.answerMode, title: state.title, material: state.material,
    materialCtx: state.materialCtx, keywords: state.keywords, paper: state.paper,
    idx: state.idx, follow: state.follow, records: state.records, skipped: state.skipped, runId: state.runId,
  })); } catch (_) {}
}
function restore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.paper || !d.paper.length) return false;
    Object.assign(state, d);
    return true;
  } catch (_) { return false; }
}

/* ---------- Step 1 ---------- */
const titleInput = $('#iv-role');
const resumeBox = $('#iv-resume');
const resumeName = $('#iv-resume-name');
const parsePanel = $('#iv-parse');
const parseStat = $('#iv-parse-stat');
const parseGrid = $('#iv-parse-grid');
let materialFile = '';
let materialData = null;

const MAX_SIZE = 10 * 1024 * 1024;

async function handleFile(f) {
  if (!f) return;
  if (f.size > MAX_SIZE) { showParseError(`文件 ${(f.size / 1048576).toFixed(1)}MB，超过 10MB 上限`); return; }
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'docx', 'txt', 'md', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) { showParseError('只支持 PDF / Word / txt / 图片'); return; }
  materialFile = f.name;
  resumeName.textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
  resumeBox.classList.add('is-ready');
  $('#iv-resume-tip').hidden = true;
  parsePanel.hidden = false;
  parseStat.textContent = '正在解析…';
  parseStat.className = 'iv-parse__stat is-busy';
  parseGrid.innerHTML = '';
  try {
    const r = await Resume.parse(f, (stage) => { parseStat.textContent = stage + '…'; });
    materialData = r;
    parseStat.className = 'iv-parse__stat is-ok';
    parseStat.innerHTML = `✓ 已解析 <b>${escapeHtml(r.name || r.file)}</b> · ${r.pages} 页 · ${r.chars} 字`;
    parseGrid.innerHTML = r.skills && r.skills.length
      ? `<dt>识别到的关键词</dt><dd>${r.skills.slice(0, 12).map(s => `<span class="iv-parse__sk">${escapeHtml(s)}</span>`).join('')}</dd>`
      : '<dt>已提取正文</dt><dd>将据此生成答辩问题</dd>';
  } catch (err) {
    materialData = null;
    showParseError(err && err.message ? err.message : '解析失败，请换一个文件');
  }
}

function showParseError(msg) {
  materialData = null;
  parsePanel.hidden = false;
  parseStat.className = 'iv-parse__stat is-error';
  parseStat.textContent = '✗ ' + msg;
  parseGrid.innerHTML = '';
}

function setEngineBadge(text, isAI) {
  ['#engine-badge', '#engine-badge-live'].forEach(sel => {
    const el = $(sel);
    if (el) { el.textContent = text; el.classList.toggle('is-ai', !!isAI); }
  });
}

resumeBox.addEventListener('click', () => $('#iv-file').click());
resumeBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#iv-file').click(); } });
$('#iv-file').addEventListener('change', (e) => handleFile(e.target.files[0]));
['dragover', 'dragenter'].forEach(ev => resumeBox.addEventListener(ev, e => { e.preventDefault(); resumeBox.classList.add('is-drag'); }));
['dragleave', 'drop'].forEach(ev => resumeBox.addEventListener(ev, e => { e.preventDefault(); resumeBox.classList.remove('is-drag'); }));
resumeBox.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

/** 从论文文本里抽一组关键词，供「是否切题」判定与评分使用 */
function thesisKeywords(text) {
  const base = ['研究', '方法', '实验', '数据', '结果', '结论', '模型', '算法', '系统', '设计', '分析', '验证', '创新', '贡献', '局限', '展望'];
  const titleWords = (state.title || '').split(/[\s，。、：:·\-—–/()（）]+/).filter(w => w.length >= 2);
  const textWords = (text || '').split(/[\s，。、：:；;\n]+/).filter(w => w.length >= 2 && w.length <= 10);
  const freq = {};
  textWords.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const top = Object.entries(freq).filter(([w]) => !/^[\d%年月日]+$/.test(w)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
  return Array.from(new Set([...titleWords, ...top, ...base])).slice(0, 20);
}

/** 论文摘要（发给 AI 出题/追问/报告用） */
function thesisSummary() {
  return (state.material || '').slice(0, 2000);
}

function setStartBusy(busy) {
  const btn = $('#iv-start');
  if (btn) { btn.disabled = busy; btn.textContent = busy ? '正在生成答辩问题…' : '开始答辩'; }
}

$('#iv-start').addEventListener('click', () => {
  if (!materialData) {
    resumeBox.focus();
    resumeBox.classList.add('is-error');
    setTimeout(() => resumeBox.classList.remove('is-error'), 1400);
    return;
  }
  $('#iv-mode').hidden = false;
});

$('#iv-mode-cancel').addEventListener('click', () => { $('#iv-mode').hidden = true; });
$('#iv-mode').addEventListener('click', (e) => { if (e.target === $('#iv-mode')) $('#iv-mode').hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#iv-mode').hidden) $('#iv-mode').hidden = true; });
$('#iv-mode-text').addEventListener('click', () => startDefense('text'));
$('#iv-mode-voice').addEventListener('click', () => startDefense('voice'));

/** 选定回答方式后正式开局 */
async function startDefense(mode) {
  $('#iv-mode').hidden = true;
  state.answerMode = mode;
  state.title = titleInput.value.trim() || (materialFile || '未命名论文');
  state.material = (materialData && materialData.text) ? materialData.text : '';
  state.materialCtx = materialData;
  state.keywords = thesisKeywords(state.material);
  state.runId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  state.idx = 0; state.follow = 0; state.records = []; state.skipped = 0;

  $('#live-role').textContent = state.title;
  setEngineBadge(LLM.label(), !!LLM.state.ai);

  if (mode === 'voice') {
    state.paper = [];
    $('#live-count').textContent = '自由语音答辩';
    $('#live-bar').style.width = '0%';
    $('#live-plan').textContent = '语音答辩 · 由 Qwen 实时模型驱动';
    goto(2);
    save();
    return;
  }

  const count = Number($('input[name="iv-count"]:checked').value);
  setStartBusy(true);
  try {
    const p = await LLM.defensePaper({
      thesis: { title: state.title, summary: thesisSummary() },
      count,
    });
    state.paper = p.questions.map(q => ({ ...q }));
  } catch (e) {
    state.paper = [];   // AI 失败时给一句提示，让用户重试
  }
  setStartBusy(false);

  if (!state.paper.length) {
    const toast = $('#zt-toast');
    if (toast) { toast.textContent = '答辩问题生成失败，请重试或检查网络。'; toast.classList.add('is-on'); setTimeout(() => toast.classList.remove('is-on'), 3200); }
    return;
  }

  $('#live-plan').textContent = `共 ${state.paper.length} 题 · AI 根据论文生成`;
  goto(2);
  askCurrent();
  save();
}

/* ---------- Step 2 ---------- */
function goto(n) {
  state.step = n;
  $$('.iv-step').forEach(el => el.classList.toggle('is-on', el.dataset.step === String(n)));
  if (n === 2) { applyModeUI(); focusAnswer(); }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function applyModeUI() {
  const isVoice = state.answerMode === 'voice';
  const composer = $('#iv-composer');
  const voice = $('#iv-voice');
  if (composer) composer.hidden = isVoice;
  if (voice) voice.hidden = !isVoice;
}
function focusAnswer() {
  if (state.answerMode === 'voice') { const b = $('#iv-voice-btn'); if (b) b.focus(); }
  else { const i = $('#iv-input'); if (i) i.focus(); }
}
function cur() { return state.paper[state.idx]; }

function renderProgress() {
  const pct = state.paper.length ? (state.idx / state.paper.length) * 100 : 0;
  $('#live-count').textContent = `第 ${Math.min(state.idx + 1, state.paper.length)} 题 / 共 ${state.paper.length} 题`;
  $('#live-bar').style.width = pct + '%';
}
function push(html, cls) {
  const el = document.createElement('div');
  el.className = 'iv-msg iv-msg--' + cls;
  el.innerHTML = html;
  $('#thread').appendChild(el);
  $('#thread').scrollTop = $('#thread').scrollHeight;
  return el;
}
function aiMsg(q) {
  const type = TYPES[q.type] || TYPES.behavior;
  push(
    `<div class="iv-msg__head">
       <span class="iv-avatar" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 答辩评委</span><span class="iv-tag">${type.abbr}</span>
     </div>
     <p class="iv-msg__text">${escapeHtml(q.t)}</p>
     <p class="iv-msg__meta">${type.method}${q.hint ? ' · 考察：' + escapeHtml(q.hint) : ''}</p>`,
    'ai');
}
function aiFollow(text, rule) {
  push(
    `<div class="iv-msg__head">
       <span class="iv-avatar iv-avatar--follow" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 答辩评委</span>
       <span class="iv-tag iv-tag--follow">追问 ${state.follow} / 2</span>
       <span class="iv-rule" title="本轮触发规则 ${rule}">规则 ${rule}</span>
     </div>
     <p class="iv-msg__text">${escapeHtml(text)}</p>`,
    'follow');
}
function sysMsg(text) { push(`<p class="iv-sys">${escapeHtml(text)}</p>`, 'sys'); }

function askCurrent() {
  const q = cur();
  state.follow = 0;
  state.records[state.idx] = { q, answers: [], followAnswers: [], first: null };
  renderProgress();
  aiMsg(q);
  save();
}

/* --- 发送 --- */
const composer = $('#iv-composer');
const ta = $('#iv-input');

function rulePath(a, q, rec) {
  if (state.follow >= 2) { nextQuestion(); return; }
  if (a.code === 'complete') { nextQuestion(); }
  else {
    state.follow += 1;
    rec.follow = state.follow;
    const fu = makeFollowUp(q, a, state.keywords, state.follow - 1);
    setTimeout(() => { aiFollow(fu.text, fu.rule); save(); focusAnswer(); }, 420);
  }
  save();
}
function typing() {
  const el = push(
    `<div class="iv-msg__head">
       <span class="iv-avatar iv-avatar--follow" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 答辩评委</span>
     </div>
     <p class="iv-msg__text iv-thinking"><i></i><i></i><i></i></p>`,
    'follow');
  return el;
}

function send(raw) {
  const text = (raw == null ? ta.value : raw).trim();
  if (!text) return;
  if (raw == null) { ta.value = ''; ta.style.height = 'auto'; }
  push(`<p class="iv-msg__text">${escapeHtml(text)}</p>`, 'me');

  const q = cur();
  const a = analyze(text, state.keywords);
  const rec = state.records[state.idx];
  rec.answers.push(a);
  if (rec.follow === undefined) rec.follow = 0;
  if (!rec.first) rec.first = a.s;
  else rec.followAnswers.push(a.s);

  if (state.follow >= 2) { nextQuestion(); save(); return; }
  if (!LLM.state.ai) { rulePath(a, q, rec); return; }

  const ghost = typing();
  LLM.defenseNext({
    thesis: { title: state.title, summary: thesisSummary() },
    question: q.t,
    questionType: (TYPES[q.type] || TYPES.behavior).label,
    follow: state.follow,
    qno: state.idx + 1,
    total: state.paper.length,
    answers: rec.answers.map(x => x.s.raw),
  }).then((res) => {
    ghost.remove();
    if (res.action === 'next') { nextQuestion(); }
    else {
      state.follow += 1; rec.follow = state.follow;
      aiFollow(res.text || '（这一题我想多问一句）', res.rule || 1);
      focusAnswer();
    }
    save();
  }).catch(() => {
    ghost.remove();
    setEngineBadge('规则引擎（AI 调用失败，已自动回退）');
    rulePath(a, q, rec);
  });
}

function nextQuestion() {
  const rec = state.records[state.idx];
  if (rec && (!rec.first || !rec.answers.length)) state.skipped++;
  if (state.idx >= state.paper.length - 1) { finish(); return; }
  state.idx += 1;
  setTimeout(() => {
    sysMsg(`—— 第 ${state.idx + 1} 题 · ${(TYPES[cur().type] || TYPES.behavior).label} ——`);
    askCurrent();
    focusAnswer();
  }, 380);
}

composer.addEventListener('submit', (e) => { e.preventDefault(); send(); });
ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; $('#iv-send').disabled = !ta.value.trim(); });
$('#iv-skip').addEventListener('click', () => { sysMsg('已跳过本题。'); nextQuestion(); });
$('#iv-quit').addEventListener('click', () => {
  if (state.answerMode === 'voice') {
    if (confirm('结束本次语音答辩？')) { stopVoiceSession(); showVoiceReport(); }
  } else if (confirm('结束答辩并生成报告？已答内容会保留。')) {
    finish();
  }
});

/* ---------- Step 3 ---------- */
function finish() {
  if (!state.title || !state.paper.length) { goto(1); return; }
  if (LLM.state.ai && !state._aiReported) {
    state._aiReported = true;
    const tip = $('#rp-loading');
    tip.hidden = false;
    LLM.defenseReport({
      thesis: { title: state.title, summary: thesisSummary() },
      records: state.records.map((r, i) => ({
        i: i + 1, type: r.q.type, typeName: (TYPES[r.q.type] || TYPES.behavior).abbr,
        question: r.q.t, answers: r.answers.map(x => x.s.raw),
      })),
    }).then((r) => { tip.hidden = true; renderReport(mergeAI(r)); })
      .catch(() => { tip.hidden = true; setEngineBadge('规则引擎（AI 报告失败，已自动回退）'); renderReport(scoreRun(state)); });
    return;
  }
  renderReport(scoreRun(state));
}

function mergeAI(ai) {
  const local = scoreRun(state);
  const dims = { ...local.dims };
  for (const k of Object.keys(dims)) { const v = ai.dims && ai.dims[k]; if (typeof v === 'number' && v >= 1 && v <= 5) dims[k] = v; }
  const total = Math.max(1, Math.min(5, Math.round(ai.total || (dims.pro * .3 + dims.logic * .3 + dims.com * .25 + dims.adapt * .15))));
  return { total, dims, evidence: (ai.evidence && ai.evidence.length) ? ai.evidence : local.evidence, ai };
}

/* ---------- 成长归档 ---------- */
const GROWTH_KEY = 'zt-growth-v1';
function archiveGrowth(sc) {
  if (!state.runId || !state.title) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(GROWTH_KEY)) || []; } catch (_) {}
  if (!Array.isArray(list)) list = [];
  if (list.some(x => x.id === state.runId)) return;
  const codes = [];
  state.records.forEach(r => r.answers.forEach(a => { if (a.code) codes.push(a.code); }));
  list.push({
    id: state.runId, at: Date.now(), role: '答辩 · ' + (state.title || '论文'), family: 'defense',
    total: sc.total, dims: { pro: sc.dims.pro, com: sc.dims.com, logic: sc.dims.logic, adapt: sc.dims.adapt },
    answered: state.records.filter(r => r.answers.length).length, skipped: state.skipped, codes,
  });
  if (list.length > 200) list = list.slice(-200);
  try { localStorage.setItem(GROWTH_KEY, JSON.stringify(list)); } catch (_) {}
}

function renderReport(sc) {
  archiveGrowth(sc);
  const ai = sc.ai;
  const adv = advise(state, sc);
  $('#rp-role').textContent = state.title;
  $('#rp-family').textContent = '模拟答辩';
  $('#rp-time').textContent = new Date().toLocaleString('zh-CN', { hour12: false });
  $('#rp-answered').textContent = `${state.records.filter(r => r.answers.length).length} / ${state.paper.length}`;
  $('#rp-skipped').textContent = state.skipped;
  $('#rp-total-num').textContent = sc.total;
  $('#rp-total-bar').style.width = (sc.total / 5 * 100) + '%';
  const L = v => v === 5 ? '卓越' : v === 4 ? '优秀' : v === 3 ? '合格' : v === 2 ? '待提升' : '不合格';
  $('#rp-total-label').textContent = L(sc.total);
  $('#rp-dims').innerHTML = ['pro', 'logic', 'com', 'adapt'].map(k => {
    const b = BARS[k], v = sc.dims[k];
    return `<li class="rp-dim">
      <div class="rp-dim__top"><span class="rp-dim__name">${b.name}</span><span class="rp-dim__score">${v}<i>/5</i><em>${L(v)}</em></span></div>
      <div class="rp-bar"><span style="width:${v / 5 * 100}%"></span></div>
      <p class="rp-dim__anchor">${b.bars[v]}</p>
    </li>`;
  }).join('');
  $('#rp-evidence').innerHTML = sc.evidence.map(x => `<li>${escapeHtml(x)}</li>`).join('');
  $('#rp-review').innerHTML = state.records.map((r, i) => {
    if (!r.answers.length) {
      return `<li class="rp-item rp-item--skip">
        <div class="rp-item__q"><span class="iv-tag iv-tag--skip">已跳过</span>${escapeHtml(r.q.t)}</div>
        <p class="rp-item__empty">这题没有作答，不计入评分。</p>
      </li>`;
    }
    const notes = (ai && ai.perQuestion && ai.perQuestion.find(x => x.i === i + 1)?.comment)
      ? [ai.perQuestion.find(x => x.i === i + 1).comment]
      : noteFor(r);
    const tags = (ai && ai.perQuestion && ai.perQuestion.find(x => x.i === i + 1)?.tags?.length)
      ? ai.perQuestion.find(x => x.i === i + 1).tags
      : [...new Set(r.answers.map(a => RULE_TAG[a.code]))];
    return `<li class="rp-item">
      <div class="rp-item__q"><span class="iv-tag">${(TYPES[r.q.type] || TYPES.behavior).abbr}</span>${escapeHtml(r.q.t)}<span class="rp-item__no">第 ${i + 1} 题</span></div>
      <div class="rp-item__body">
        <p class="rp-item__label">你的回答</p>
        ${r.answers.map(a => `<p class="rp-item__a">${escapeHtml(a.s.raw || '')}</p>`).join('')}
        <p class="rp-item__label">AI 点评</p>
        <ul class="rp-item__notes">${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
        <p class="rp-item__tags">${tags.map(t => `<span class="rp-flag">${t}</span>`).join('')}</p>
      </div>
    </li>`;
  }).join('');
  const advList = (ai && ai.advice && ai.advice.length) ? ai.advice : adv;
  $('#rp-advice').innerHTML = advList.map(a => `<li class="rp-advice"><p class="rp-advice__t">${escapeHtml(a.t)}</p><p class="rp-advice__d">${escapeHtml(a.d)}</p></li>`).join('');
  $('#rp-loading').hidden = true;
  $('#rp-source').textContent = ai ? '评分与点评由大模型生成' : '评分由本地规则引擎折算';
  $('#rp-source').classList.toggle('is-ai', !!ai);
  goto(3);
  try { sessionStorage.removeItem(KEY); } catch (_) {}
}

$('#rp-again').addEventListener('click', () => {
  titleInput.value = '';
  resumeName.textContent = '';
  resumeBox.classList.remove('is-ready');
  materialFile = ''; materialData = null;
  parsePanel.hidden = true; parseGrid.innerHTML = '';
  $('#iv-resume-tip').hidden = false; $('#iv-file').value = '';
  $('#thread').innerHTML = '';
  $('#iv-input').value = '';
  try { sessionStorage.removeItem(KEY); } catch (_) {}
  goto(1);
});

/* ==================== 语音答辩（Qwen Audio Realtime） ==================== */
const VOICE = {
  key: 'sk-ws-H.YLHDEID.trCd.MEYCIQDE3-AcTFyCs4NQBFV_bpdco1VLOz8ArcIkrvYsnXt3YwIhAJeAc1MKPYJ7JD-sLito3srM7hIaTc1zSA5_VWUFXQGy',
  url: 'wss://cn-beijing.maas.qianwenaiapi.com/api-ws/v1/realtime?model=qwen-audio-3.1-realtime-flash',
  keyQuery: 'api_key',
  voice: 'longanqian',
};
const voiceBtn = $('#iv-voice-btn');
const voiceBtnLabel = $('#iv-voice-btn-label');
const voiceHint = $('#iv-voice-hint');
let voiceWS = null, voiceStream = null, voiceCtx = null, voiceProc = null, voiceActive = false, voicePlayCtx = null, voiceAudioQueue = [];
let voiceTimer = null;
let voiceTranscript = [];

function voiceURL() { const sep = VOICE.url.includes('?') ? '&' : '?'; return VOICE.url + sep + VOICE.keyQuery + '=' + encodeURIComponent(VOICE.key); }
function voiceInstructions() {
  const title = state.title || '这篇论文';
  return `你是高校答辩委员会成员，正在对一名学生的论文「${title}」做模拟答辩。`
    + (state.material ? `论文内容摘要：${thesisSummary()}` : '（论文内容未提供）')
    + '请像真实答辩评委一样：先简短开场，然后围绕论文的研究背景、方法、结果、创新点与局限逐层提问，根据对方的回答自然追问，检验他是否真做、真懂。'
    + '全程用中文、口语化、一次只问一个问题。';
}
function startVoiceSession() {
  if (voiceActive) return;
  voiceActive = true;
  voiceBtnLabel.textContent = '结束对话';
  voiceHint.textContent = '请直接开口说话，AI 答辩评委用语音回应你。';
  Paralinguistic.reset();
  voiceTranscript = [];
  const meta = $('#iv-voice-meta');
  if (meta) meta.hidden = false;
  voiceTimer = setInterval(updateVoiceMeta, 500);
  voiceWS = new WebSocket(voiceURL());
  voiceWS.onopen = () => {
    voiceWS.send(JSON.stringify({ type: 'session.update', session: {
      modalities: ['text', 'audio'], voice: VOICE.voice,
      turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
      instructions: voiceInstructions(),
    }}));
    openMic();
  };
  voiceWS.onmessage = (e) => {
    let ev; try { ev = JSON.parse(e.data); } catch (_) { return; }
    if (ev.type === 'conversation.item.input_audio_transcription.completed' && ev.transcript) {
      Paralinguistic.addTranscript(ev.transcript);
      voiceTranscript.push({ who: 'me', text: ev.transcript });
      push(`<p class="iv-msg__text">${escapeHtml(ev.transcript)}</p>`, 'me');
    } else if (ev.type === 'response.audio_transcript.done' && ev.transcript) {
      voiceTranscript.push({ who: 'ai', text: ev.transcript });
      aiSay(ev.transcript);
      flushVoiceAudio();
    } else if (ev.type === 'response.audio.delta' && ev.delta) {
      voiceAudioQueue.push(ev.delta);
    } else if (ev.type === 'error') {
      voiceHint.textContent = '语音服务出错：' + (ev.error && ev.error.message ? ev.error.message : '未知错误');
    }
  };
  voiceWS.onerror = () => { stopVoiceSession(); voiceHint.textContent = '语音服务连接失败，请检查网络或 API key。'; };
  voiceWS.onclose = () => { voiceWS = null; if (voiceActive) stopVoiceSession(); };
}
function aiSay(text) {
  push(
    `<div class="iv-msg__head">
       <span class="iv-avatar iv-avatar--follow" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 答辩评委</span>
     </div>
     <p class="iv-msg__text">${escapeHtml(text)}</p>`,
    'ai');
}
function openMic() {
  const gUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!gUM) { stopVoiceSession(); voiceHint.textContent = '当前浏览器不支持录音，请换用 Chrome / Edge。'; return; }
  gUM.call(navigator.mediaDevices, { audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } }).then((stream) => {
    if (!voiceActive) { stream.getTracks().forEach(t => t.stop()); return; }
    voiceStream = stream;
    const AC = window.AudioContext || window.webkitAudioContext;
    voiceCtx = new AC({ sampleRate: 16000 });
    if (voiceCtx.state === 'suspended') voiceCtx.resume();
    const src = voiceCtx.createMediaStreamSource(stream);
    voiceProc = voiceCtx.createScriptProcessor(4096, 1, 1);
    voiceProc.onaudioprocess = (e) => {
      if (!voiceWS || voiceWS.readyState !== WebSocket.OPEN) return;
      const ch = e.inputBuffer.getChannelData(0);
      Paralinguistic.addFrame(ch);
      const pcm = float32To16(ch);
      voiceWS.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: arrayBufferToBase64(pcm) }));
    };
    src.connect(voiceProc);
    voiceProc.connect(voiceCtx.destination);
    voiceHint.textContent = '麦克风已就绪，请开始说话。';
  }).catch(() => { stopVoiceSession(); voiceHint.textContent = '无法访问麦克风：请允许浏览器使用麦克风权限。'; });
}
function float32To16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); out[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
  return out.buffer;
}
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function flushVoiceAudio() {
  if (!voiceAudioQueue.length) return;
  const chunks = voiceAudioQueue; voiceAudioQueue = [];
  const bytes = chunks.map(base64ToBytes);
  const total = bytes.reduce((n, b) => n + b.length, 0);
  if (!total) return;
  const all = new Uint8Array(total); let off = 0;
  for (const b of bytes) { all.set(b, off); off += b.length; }
  const pcm = new Int16Array(all.buffer, 0, Math.floor(total / 2));
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!voicePlayCtx) voicePlayCtx = new AC({ sampleRate: 24000 });
  const buf = voicePlayCtx.createBuffer(1, pcm.length, 24000);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
  const src = voicePlayCtx.createBufferSource(); src.buffer = buf; src.connect(voicePlayCtx.destination); src.start();
}
function updateVoiceMeta() {
  const m = Paralinguistic.snapshot();
  const el = (id, v) => { const n = $(id); if (n) n.textContent = v; };
  el('#iv-meta-rate', m.rate);
  el('#iv-meta-pause', m.pauses);
  el('#iv-meta-filler', m.fillers);
  el('#iv-meta-vol', m.volumeStability);
}
function voiceTranscriptText() {
  return voiceTranscript.map(x => (x.who === 'me' ? '候选人：' : '评委：') + x.text).join('\n');
}
function showVoiceReport() {
  const m = Paralinguistic.snapshot();
  $('#iv-pl-metrics').innerHTML = [
    ['语速', m.rate + ' 字/分'], ['停顿', m.pauses + ' 次'], ['填充词', m.fillers + ' 个'], ['音量稳定', m.volumeStability + '%'],
  ].map(([k, v]) => `<div class="iv-pl__m"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#iv-pl-comment').textContent = 'AI 点评生成中…';
  $('#iv-voice-report').hidden = false;
  if (window.LLM && LLM.state.ai) {
    LLM.paralinguistic({ transcript: voiceTranscriptText(), metrics: m }).then((r) => {
      $('#iv-pl-comment').textContent = r.comment || '（暂无点评）';
    }).catch(() => { $('#iv-pl-comment').textContent = 'AI 点评生成失败。'; });
  } else {
    $('#iv-pl-comment').textContent = '（AI 未连接，仅显示指标）';
  }
}
function stopVoiceSession() {
  voiceActive = false;
  voiceBtnLabel.textContent = '开始语音答辩';
  if (voiceTimer) { clearInterval(voiceTimer); voiceTimer = null; }
  const meta = $('#iv-voice-meta');
  if (meta) meta.hidden = true;
  if (voiceProc) { try { voiceProc.disconnect(); } catch (_) {} voiceProc = null; }
  if (voiceStream) { voiceStream.getTracks().forEach(t => t.stop()); voiceStream = null; }
  if (voiceCtx) { try { voiceCtx.close(); } catch (_) {} voiceCtx = null; }
  if (voiceWS) { try { voiceWS.close(); } catch (_) {} voiceWS = null; }
  if (voicePlayCtx) { try { voicePlayCtx.close(); } catch (_) {} voicePlayCtx = null; }
  voiceAudioQueue = [];
}
if (voiceBtn) voiceBtn.addEventListener('click', () => {
  if (voiceActive) { stopVoiceSession(); showVoiceReport(); }
  else startVoiceSession();
});
const switchText = $('#iv-switch-text');
if (switchText) switchText.addEventListener('click', () => { stopVoiceSession(); goto(1); $('#thread').innerHTML = ''; save(); });

const plClose = $('#iv-pl-close');
if (plClose) plClose.addEventListener('click', () => { $('#iv-voice-report').hidden = true; });
const plAgain = $('#iv-pl-again');
if (plAgain) plAgain.addEventListener('click', () => { $('#iv-voice-report').hidden = true; goto(1); $('#thread').innerHTML = ''; save(); });

/* ---------- 启动 ---------- */
(function init() {
  LLM.probe().then(() => {
    setEngineBadge(LLM.label(), !!LLM.state.ai);
    const n = $('#engine-note');
    if (n) n.textContent = LLM.state.ai ? `已连接 AI：${LLM.label()}。` : 'AI 未连接，请检查配置。';
  });
  if (restore()) {
    if (state.step === 2 && state.answerMode === 'voice') {
      $('#live-role').textContent = state.title;
      $('#live-count').textContent = '自由语音答辩';
      $('#live-bar').style.width = '0%';
      $('#live-plan').textContent = '语音答辩 · 由 Qwen 实时模型驱动';
      goto(2);
    } else if (state.step === 2) {
      $('#live-role').textContent = state.title;
      goto(2);
      renderProgress();
      sysMsg(`（上次进度已恢复：答到第 ${state.idx + 1} 题）`);
      aiMsg(cur());
    } else if (state.step === 3) {
      finish();
    }
  }
})();

})();
