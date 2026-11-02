/* ============================================================
   职面通 · 简历优化引擎
   ------------------------------------------------------------
   输入：岗位 JD + 个人简历
   输出：
     一、评价（五个维度）
        1 硬性条件匹配度  2 成果可量化性  3 语言专业度
        4 篇幅合理性      5 针对性
     ＋ 建议段（逐条对应上面的扣分点）
     二、改前改后对比（左改后 / 右改前）
   ------------------------------------------------------------
   ⚠️ 这是本地规则引擎：靠关键词与结构信号判定，不是大模型。
      判定依据全部写在结果里，能被逐条复核。
   ============================================================ */
const Optimizer = (() => {
  'use strict';

  /* ============================================================
     一、JD 解析
     ============================================================ */
  const EDU_RANK = { '大专': 1, '专科': 1, '本科': 2, '硕士': 3, '研究生': 3, '博士': 4, 'MBA': 3 };

  const DEGREE_RE = /(博士|硕士|研究生|本科|大专|专科|MBA)/;
  const YEAR_RE = /(?:至少|不少于)?\s*(\d+)\s*年(?:以上)?\s*(?:(?:相关|工作|从业|行业|产品|运营|开发|设计|财务|销售|互联网|电商|游戏|测试|市场|人事|客服)\s*){0,2}(?:经验|经历)/;
  const YEAR_RE2 = /(\d+)\s*-\s*(\d+)\s*年/;
  const MAJOR_RE = /(?:专业[：:\s]*|相关专业[：:\s]*)([一-龥A-Za-z]{2,10})/;
  // 只保留不会误伤的学科名（"设计""数学""教育"这类词在 JD 正文里太常见，已剔除）
  const MAJOR_LIST = ['计算机', '软件工程', '电子信息', '通信工程', '自动化', '统计学', '应用数学',
    '金融学', '会计学', '财务管理', '经济学', '市场营销', '人力资源管理', '管理科学', '工商管理',
    '新闻传播', '视觉传达', '数字媒体', '机械工程', '材料科学', '生物医学', '化学工程', '土木工程',
    '建筑学', '临床医学', '药学', '法学', '应用心理学'];
  const CERT_RE = /(CPA|注册会计师|初级会计|中级会计|高级会计师|教师资格证|律师资格|医师资格|执业医师|注册建筑师|建造师|证券从业|基金从业|银行从业|人力资源管理师|三级|二级|一级|六级|四级|雅思|托福|PMP|CFA|ACCA|注册税务师|审计师|CPA)/gi;
  const INDUSTRY_RE = /(?:有|具备|拥有)?\s*([一-龥]{2,6})\s*(?:行业|领域|背景)(?:经验|经历|背景)?/g;
  const NOISE_RE = /负责|参与|协助|配合|完成|帮助|了解|熟悉|学习|跟进|负责维护|相关工作|其他工作|以及其他|其他|部门|团队工作|沟通协调|良好|优秀|能力强|踏实|积极主动|认真负责|吃苦耐劳|抗压能力强/;

  /* 岗位能力词表：覆盖八个职位族的常见职责与要求用语。
     命中即视为「JD 明确提到的能力项」，用于针对性评估与改写时补词。 */
  // 硬技能（工具/技术/方法）：能当"我熟悉 X"说；软能力词（留存/沟通协调等）不算
  // 这些词出现在 JD/简历里很常见，但当"我扛过的能力"说出来很别扭
  const NOISE_TERMS = new Set([
    '中台','平台','系统','业务','产品','数据','指标','场景','渠道','用户','客户','需求','项目','团队','流程',
    '方案','工具','业务线','电商','互联网','计算机','软件','技术','内容','活动','市场','销售','岗位','职责',
    '要求','优先','能力','经验','熟悉','掌握','具备','完成','参与','负责','推动','支持','独立','良好','沟通',
    '协调','抗压','素质','学历','专业','证书','行业','公司','业务背景','实习经历','工作经历','项目经历',
  ]);

  const TOOL_LEX = new Set([
    'JavaScript','TypeScript','Python','Java','Go','C++','C#','Ruby','PHP','Swift','Kotlin','Rust','SQL','MySQL',
    'Redis','MongoDB','Docker','Linux','Git','Excel','Figma','Axure','Tableau','Photoshop','Illustrator',
    'Premiere','PowerBI','SPSS','Eclipse','IntelliJ','VSCode','Spring','React','Vue','Angular','Svelte',
    'Next.js','Nuxt','Node.js','Express','NestJS','Django','Flask','Spark','Hadoop','Hive','Matlab',
    'AutoCAD','SolidWorks','Unity','Blender','SEO','SEM','Axure Pro','墨刀','ProcessOn','Visio','Jira',
    'AB测试','A/B测试','需求分析','竞品分析','用户研究','埋点','数据分析','PMP','CFA','CPA','教资',
  ]);

  const DOMAIN_TERMS = [
    // 通用 / 产品
    '需求分析', '需求评审', '需求管理', '产品规划', '产品设计', '功能设计', '竞品分析', '用户研究', '用户画像',
    '用户访谈', '用户反馈', '用户体验', '交互设计', '原型设计', '产品迭代', '路线图', '产品定位', '产品经理',
    '商业化', '中台', '平台化', '指标体系', '数据驱动', 'A/B测试', 'AB测试', '漏斗', '埋点', '转化率', '留存率',
    '复购率', '拉新', '促活', 'GMV', 'ROI', '北极星指标', '用户增长', '数据看板', '复盘',
    // 运营
    '内容运营', '活动运营', '用户运营', '社群运营', '私域运营', '会员运营', '渠道运营', '活动策划', '内容策划',
    '文案', '短视频', '直播', 'SEO', 'SEM', '投放', '新媒体', 'KOL', '种草',
    // 市场
    '品牌建设', '品牌传播', '品牌定位', '营销策划', '营销方案', '媒体投放', '公关', '渠道拓展', '预算分配',
    '创意策划', '整合营销', '曝光量', '互动率',
    // 销售
    '客户开发', '客户维护', '客户需求', '商机', '商务谈判', '报价', '合同', '签单', '成交', '回款', '续约',
    '大客户', '渠道合作', '业绩目标', 'CRM', '线索',
    // 人力
    '招聘', '社招', '校招', '内推', '人才画像', '面试', '绩效管理', '绩效考核', '薪酬体系', '员工关系',
    '劳动关系', '培训体系', '雇主品牌', '人效', '岗位画像',
    // 财务
    '财务报表', '成本核算', '预算管理', '成本控制', '费用报销', '合规', '内控', '审计', '税务', '现金流',
    '记账', '对账', '结账', '财务分析',
    // 技术
    '前后端', '接口', '数据库', '缓存', '性能优化', '架构', '代码审查', '微服务', '容器化', 'CI/CD',
    '算法', '数据仓库', 'ETL', '可视化', '系统设计', '高并发', '组件库',
    // 通用素质
    '沟通协调', '跨部门', '项目管理', '时间管理', '抗压能力', '团队管理', '目标拆解', '执行力', '快速学习',
    '独立思考', '结构化', '复盘能力', '优先级',
  ];

  const SKILL_HINTS = [
    'Java', 'Python', 'C++', 'Go', 'React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Node.js',
    'MySQL', 'Redis', 'MongoDB', 'Kafka', 'Docker', 'Kubernetes', 'Linux', 'Git', 'SQL', 'Excel',
    'Figma', 'Axure', 'Sketch', 'Tableau', 'PowerBI', 'Photoshop', 'Illustrator', 'Premiere',
    'SEO', 'SEM', '投放', '私域', '社群', '文案', '短视频', '直播', 'BD', 'CRM', 'SAP', 'OA',
    'A/B测试', 'AB测试', '转化率', '留存率', '复购率', 'GMV', 'PMP',
    '财务', '预算', '成本', '报表', '审计', '税务', '现金流', '合规', 'Excel', 'PPT', 'Word',
    '需求分析', '竞品分析', '用户研究', '用户画像', '埋点', '数据分析', '增长',
    '招聘', '绩效', '薪酬', '劳动关系', '员工关系', '校园招聘', '雇主品牌',
    '项目管理', '时间管理', '跨部门', '沟通协调', '团队管理', '目标拆解', '复盘', '汇报',
  ];

  function parseJD(raw) {
    const text = String(raw || '').replace(/\r/g, '');
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const head = lines[0] || '';

    // 岗位名：第一个像岗位名的行
    let role = head.replace(/^(岗位|职位|招聘|岗位名称|职位名称)[：:\s]*/, '').slice(0, 24);
    if (role.length > 20 || !role) role = head.slice(0, 20);

    // 学历要求
    const eduHit = text.match(/(?:学历|学历要求|最低学历)?\s*[：:]?\s*((?:博士|硕士|研究生|本科|大专|专科|MBA)[^，。；\n]{0,4})/);
    let eduNeed = eduHit ? eduHit[1].trim() : '';
    let eduMin = 0;
    for (const k in EDU_RANK) if (eduNeed.includes(k)) { eduMin = EDU_RANK[k]; break; }
    if (!eduMin) {
      const m = text.match(/(博士|硕士|研究生|本科|大专|专科|MBA)/);
      if (m) eduMin = EDU_RANK[m[1]] || 0;
    }

    // 专业要求
    // 专业只在「专业/相关专业」所在的那几行里取，避免正文里的"方案设计"被当成专业
    const majors = new Set();
    const mm = text.match(MAJOR_RE);
    if (mm) majors.add(mm[1]);
    const majorLines = text.split('\n').filter(l => /专业|方向|相关专业/.test(l)).join(' ');
    MAJOR_LIST.forEach(mj => { if (majorLines.includes(mj)) majors.add(mj); });

    // 年限
    let years = 0;
    const y1 = text.match(YEAR_RE);
    const y2 = text.match(YEAR_RE2);
    if (y1) years = Number(y1[1]);
    else if (y2) years = Number(y2[1]);
    else {
      const y3 = text.match(/经验\s*(\d+)\s*年/);
      if (y3) years = Number(y3[1]);
    }

    // 行业
    const industries = new Set();
    let im;
    INDUSTRY_RE.lastIndex = 0;
    while ((im = INDUSTRY_RE.exec(text))) {
      const raw = im[1];
      if (!raw || raw.length < 2) continue;
      if (/任职|岗位|职责|要求|能力|优先|学历|相关|以下|以上|工作/.test(raw)) continue;
      // "电商行业" → 核心词 "电商"，简历里写"电商行业背景"也能命中
      const core = raw.replace(/(行业|领域|背景|相关)$/, '');
      if (core.length >= 2) industries.add(core);
    }
    // 证书
    const certs = new Set();
    let cm;
    CERT_RE.lastIndex = 0;
    while ((cm = CERT_RE.exec(text))) certs.add(cm[0]);

    // 技能关键词
    const flat = text.replace(/\s+/g, '');   // "A/B 测试" → "A/B测试"
    const skills = SKILL_HINTS.filter(s => flat.includes(s.replace(/\s+/g, '')));

    // 职责 / 要求分句
    const respLines = lines.filter(l => l.length > 6 && !/职责|要求|资格|描述|条件|福利|薪资|职责描述|岗位要求|任职要求|公司简介|关于我们|联系方式/.test(l) || /负责|承担|主导|搭建|制定|推动|开发|运营|管理|设计|分析/.test(l));
    const respRaw = respLines.join('\n');

    // 关键词集合：用于「针对性」评估
    // 用策展词表而不是正则刮——正则会产出"与方案设计""搭建指标"这种没法用的碎片
    const kw = new Set();
    skills.forEach(x => kw.add(x));
    majors.forEach(m => kw.add(m));
    industries.forEach(i => kw.add(i));
    DOMAIN_TERMS.forEach(t => { if (text.includes(t)) kw.add(t); });

    return {
      raw: text, role, lines,
      eduNeed, eduMin,
      majors: [...majors], years,
      industries: [...industries], certs: [...certs],
      skills, keywords: [...kw],
      respRaw,
    };
  }

  /* ============================================================
     二、简历侧信号提取
     ============================================================ */
  const WEAK_VERB = ['负责', '参与', '协助', '配合', '完成', '帮助', '了解', '熟悉', '学习', '跟进', '维护', '支持', '处理', '承接', '对接'];
  const STRONG_VERB = ['主导', '牵头', '搭建', '设计', '重构', '优化', '落地', '推动', '策划', '统筹', '独立', '从0到1', '从 0 到 1'];
  const RESULT_WORD = ['提升', '降低', '增长', '下降', '优化', '上线', '交付', '产出', '完成', '获得', '节省', '达成',
    '翻倍', '荣获', '入选', '降到', '减少', '增至', '提升至', '增长至', '达到', '突破', '覆盖', '拉动', '带动', '改善', '好评', '省下'];
  const FILLER = ['认真', '积极', '努力', '踏实', '尽力', '尽可能', '尽力做到', '认真负责', '积极主动', '吃苦耐劳', '良好', '较强的', '具备良好的', '有较强的'];

  /** 把简历解析结果摊平成「带区块的语句列表」 */

  /** 简历正文全文：用来核对某个词到底有没有真的出现过 */
  function resumeBodyText(r) {
    const p = [];
    (r.experiences || []).forEach(e => p.push(e.head || '', e.text || ''));
    (r.projects || []).forEach(x => p.push(x.title || '', x.text || ''));
    const L = r.lines || {};
    ['eval', 'skill', 'other', 'work', 'proj', 'edu'].forEach(k => (L[k] || []).forEach(t => p.push(t)));
    (r.education || []).forEach(e => p.push([e.school, e.degree, e.major, e.period].filter(Boolean).join(' ')));
    return p.join('\n');
  }
  /** 把标题行拆成「公司」和「角色」：优先按空格分段，避免"产品经理实习生"被切成"实习生" */
  function splitOrgRole(title, role) {
    const t = String(title || '').replace(/\s+/g, ' ').trim();
    const toks = t.split(/\s+/).filter(Boolean);
    const ROLE = /经理|实习生|工程师|专员|助理|总监|主管|顾问|负责人|策划|设计师|分析师|开发|测试|运营|BD|HRBP/;
    if (toks.length > 1) {
      const roleTok = toks.find(x => ROLE.test(x));
      if (roleTok) {
        const org = toks.filter(x => x !== roleTok).join(' ').replace(/[｜|·\-—–]+/g, ' ').trim();
        return { org, role: roleTok.replace(/[｜|·\-—–]+/g, '').trim() };
      }
    }
    if (role) {
      const i = t.indexOf(role);
      if (i > 0) {
        return { org: t.slice(0, i).replace(/[｜|·\-—–\s]+/g, ' ').trim(), role };
      }
    }
    return { org: '', role: role || '' };
  }

  /** 归一化后比较：忽略空格与斜杠（A/B 测试 ≡ A/B测试） */
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s\/、,，.。·｜|\-—_]/g, ''); }

  function resumeLines(r) {
    const L = r.lines || { head: [], edu: [], work: [], proj: [], skill: [], other: [] };
    const out = [];
    const push = (sec, arr) => (arr || []).forEach((t, i) => out.push({ sec, i, text: t, idx: out.length }));
    // head 是姓名/联系方式这类固定信息，eval 走整段重写，都不进逐句改写队列
    push('work', L.work); push('proj', L.proj);
    push('edu', L.edu); push('skill', L.skill); push('other', L.other);
    return out;
  }

  /** 找「个人评价」那几句 */
  function personalEval(r) {
    const L = r.lines || {};
    if (L.eval && L.eval.length) return L.eval;       // 解析器已按小标题切出
    const head = L.head || [];
    const out = [];
    let inEval = false;
    for (const t of head) {
      if (/个人评价|自我评价|个人简介|职业评价|个人优势|自我描述/.test(t)) { inEval = true; continue; }
      if (/^(教育|工作|实习|项目|技能|证书|荣誉|获奖)/.test(t)) { inEval = false; continue; }
      if (inEval) out.push(t);
    }
    if (!out.length) {
      // 没明确小标题时，把头部看起来像自评的长句挑出来
      head.forEach(t => { if (t.length >= 20 && /我|具备|擅长|具有|熟悉|热爱/.test(t)) out.push(t); });
    }
    return out;
  }

  function hasNumber(t) { return /\d/.test(t) || /%/.test(t) || /倍|万|千|人|次/.test(t); }

  /* ============================================================
     三、五维评价
     ============================================================ */
  function evaluate(jd, r) {
    const lines = resumeLines(r);
    const all = lines.map(l => l.text);
    // 关键词/术语匹配要看完整份简历，包括个人评价（它也是内容）
    const evalTexts = personalEval(r);
    const text = all.concat(evalTexts).join('\n');
    const flat = text.replace(/\s+/g, '');        // "A/B 测试" → "A/B测试"
    const hit  = (needle, hay) => hay.replace(/\s+/g, '').includes(needle.replace(/\s+/g, ''));
    const hit2 = hit;
    const D = [];

    /* ---- 1 硬性条件匹配度 ---- */
    const hard = [];
    // 学历
    const rEdu = (r.education || [])[0] || {};
    const myEdu = rEdu.degree || (rEdu.school || '').match(DEGREE_RE);
    const myRank = myEdu ? (EDU_RANK[myEdu] || 0) : 0;
    if (jd.eduMin) {
      const ok = myRank >= jd.eduMin;
      hard.push({ item: '学历', need: jd.eduNeed || '见 JD', got: rEdu.degree || rEdu.school || '未识别', ok,
        note: ok ? '满足' : `低于要求（JD 要 ${jd.eduNeed}）` });
    }
    // 专业
    if (jd.majors.length) {
      const mine = rEdu.major || '';
      const hit = jd.majors.some(m => (mine && mine.includes(m)) || hit2(m, text));
      hard.push({ item: '专业', need: jd.majors.join(' / '), got: mine || '未识别', ok: hit,
        note: hit ? '命中 JD 专业方向' : '简历专业与 JD 不一致' });
    }
    // 工作年限
    if (jd.years) {
      const span = calcYears(r);
      const spanTxt = span >= 1 ? span + ' 年' : (span > 0 ? '不足 1 年' : '未识别');
      hard.push({ item: '工作年限', need: jd.years + ' 年以上', got: spanTxt, ok: span >= jd.years,
        note: span >= jd.years ? '满足' : (span > 0 ? `差 ${(jd.years - span).toFixed(1)} 年` : '简历里没有可算的经历时间') });
    }
    // 行业背景
    if (jd.industries.length) {
      const hit = jd.industries.some(i => hit2(i, text));
      hard.push({ item: '行业背景', need: jd.industries.join(' / '), got: hit ? '简历中有' : '简历中未见', ok: hit,
        note: hit ? '有相关行业经历' : '未体现 JD 要求的行业背景' });
    }
    // 证书
    if (jd.certs.length) {
      const miss = jd.certs.filter(c => !hit(c, text));
      hard.push({ item: '证书资质', need: jd.certs.join(' / '), got: miss.length ? '缺：' + miss.join('、') : '已具备', ok: !miss.length,
        note: miss.length ? '缺少 JD 点名的资质' : '证书齐全' });
    }
    // JD 要的技能
    if (jd.skills.length) {
      const miss = jd.skills.filter(s => !hit(s, text));
      hard.push({ item: '技能要求', need: jd.skills.slice(0, 8).join('、'), got: miss.length ? '缺：' + miss.slice(0, 8).join('、') : '全部命中', ok: !miss.length,
        note: miss.length ? `${miss.length} 项未在简历出现` : '技能项全部覆盖' });
    }
    const hardScore = hard.length ? Math.round(hard.filter(h => h.ok).length / hard.length * 100) : 70;
    D.push({
      key: 'hard', name: '硬性条件匹配度', score: hardScore, max: 100,
      desc: '学历、专业、工作年限、行业背景、证书资质与 JD 硬性条款的逐条比对。',
      rows: hard,
      gaps: hard.filter(h => !h.ok),
    });

    /* ---- 2 成果可量化性 ---- */
    const bullets = lines.filter(l => l.sec === 'work' || l.sec === 'proj');
    const quantified = bullets.filter(l => hasNumber(l.text));
    const unquant = bullets.filter(l => !hasNumber(l.text));
    const qRate = bullets.length ? Math.round(quantified.length / bullets.length * 100) : 0;
    D.push({
      key: 'quant', name: '成果可量化性', score: bullets.length ? qRate : 40, max: 100,
      desc: '看每条经历有没有数据支撑——"提升了"不如"提升了 12%"有说服力。',
      rows: [
        { item: '经历条目', need: '有结果描述的条目', got: `${bullets.length} 条`, ok: bullets.length > 0 },
        { item: '量化比例', need: '建议 70% 以上带数字', got: `${qRate}%（${quantified.length}/${bullets.length}）`, ok: qRate >= 70 },
      ],
      gaps: [],
      samples: unquant.slice(0, 4).map(l => l.text),
    });

    /* ---- 3 语言专业度 ---- */
    const weak = [];
    const filler = [];
    const long = [];
    for (const l of lines) {
      if (l.sec === 'head' || l.sec === 'edu' || l.sec === 'skill') continue;
      const w = WEAK_VERB.filter(v => l.text.startsWith(v) || l.text.includes(' ' + v));
      if (w.length) weak.push({ text: l.text, verbs: w });
      const f = FILLER.filter(x => l.text.includes(x));
      if (f.length) filler.push({ text: l.text, words: f });
      if (l.text.length > 60) long.push({ text: l.text, len: l.text.length });
    }
    // 术语使用：JD 的专业词在简历里出现几次
    const terms = jd.skills.filter(s => hit(s, text));
    const termMiss = jd.skills.filter(s => !hit(s, text));
    const langScore = Math.max(0, Math.min(100,
      100 - weak.length * 12 - filler.length * 10 - long.length * 8 - termMiss.length * 4));
    D.push({
      key: 'lang', name: '语言专业度', score: langScore, max: 100,
      desc: '用词是否精准、行业术语是否用对、句子是否拖沓带水分。',
      rows: [
        { item: '弱动词开头', need: '用「主导/搭建/推动」等强动词', got: weak.length ? `${weak.length} 处：${weak.slice(0,3).map(x=>x.verbs[0]).join('、')}` : '无', ok: !weak.length },
        { item: '口水话', need: '删掉修饰词', got: filler.length ? `${filler.length} 处：${filler.slice(0,3).map(x=>x.words[0]).join('、')}` : '无', ok: !filler.length },
        { item: '超长句', need: '单句 60 字内', got: long.length ? `${long.length} 句` : '无', ok: !long.length },
        { item: '行业术语', need: `JD 术语落到简历里`, got: termMiss.length ? `${jd.skills.length - termMiss.length}/${jd.skills.length} 命中，缺 ${termMiss.slice(0,3).join('、')}` : '全部命中', ok: !termMiss.length },
      ],
      gaps: [], samples: [], missingTerms: termMiss,
    });

    /* ---- 4 篇幅合理性 ---- */
    const evalLines = personalEval(r);
    const evalChars = evalLines.join('').length;
    const totalChars = (r.chars || text.length);      // 整份简历的口径
    const ideal = { min: 400, max: 1200 };
    let lenScore = 100;
    const lenRows = [];
    if (totalChars < ideal.min) { lenScore -= Math.min(45, (ideal.min - totalChars) / 4); lenRows.push({ item: '总篇幅', need: `${ideal.min}–${ideal.max} 字`, got: `${totalChars} 字`, ok: false }); }
    else if (totalChars > ideal.max) { lenScore -= Math.min(40, (totalChars - ideal.max) / 12); lenRows.push({ item: '总篇幅', need: `${ideal.min}–${ideal.max} 字`, got: `${totalChars} 字`, ok: false }); }
    else lenRows.push({ item: '总篇幅', need: `${ideal.min}–${ideal.max} 字`, got: `${totalChars} 字`, ok: true });
    if (evalChars > 160) { lenScore -= 20; lenRows.push({ item: '个人评价', need: '120 字以内', got: `${evalChars} 字，偏长`, ok: false }); }
    else lenRows.push({ item: '个人评价', need: '120 字以内', got: evalChars ? `${evalChars} 字` : '未识别到', ok: evalChars > 0 && evalChars <= 160 });
    const secRatio = {};
    ['work', 'proj', 'edu', 'skill', 'head'].forEach(k => {
      const c = (r.lines && r.lines[k] || []).join('').length;
      secRatio[k] = totalChars ? Math.round(c / totalChars * 100) : 0;
    });
    secRatio.eval = totalChars ? Math.round(evalChars / totalChars * 100) : 0;
    const headRatio = secRatio.head + secRatio.eval;
    if (headRatio > 30) { lenScore -= 12; lenRows.push({ item: '头部占比', need: '30% 以内', got: `${headRatio}%`, ok: false }); }
    else lenRows.push({ item: '头部占比', need: '30% 以内', got: `${headRatio}%`, ok: true });
    D.push({
      key: 'len', name: '篇幅合理性', score: Math.max(0, Math.min(100, lenScore)), max: 100,
      desc: '内容过少显空洞、过满显冗长，个人评价尤其容易写飞。',
      rows: lenRows, gaps: [], samples: [],
      ratio: secRatio,
    });

    /* ---- 5 针对性 ---- */
    const kwList = jd.keywords.filter(k => k.length >= 2);
    const hitKw = kwList.filter(k => hit(k, text));
    const ratio = kwList.length ? Math.round(hitKw.length / kwList.length * 100) : 60;
    // 个人评价里有没有点 JD 的职责/产品
    const evalTxt = evalLines.join(' ');
    const targetHit = jd.keywords.filter(k => hit(k, evalTxt)).length;
    D.push({
      key: 'target', name: '针对性', score: Math.max(0, Math.min(100, ratio * 0.7 + (targetHit ? 30 : 0))), max: 100,
      desc: '简历像不像为这个岗位写的——JD 的关键词有没有落进来。',
      rows: [
        { item: 'JD 关键词覆盖', need: '60% 以上', got: `${ratio}%（${hitKw.length}/${kwList.length}）`, ok: ratio >= 60 },
        { item: '个人评价对齐 JD', need: '点出 JD 里的职责/产品', got: targetHit ? `命中 ${targetHit} 个` : '未提及 JD 具体职责', ok: targetHit > 0 },
        { item: '岗位名称呼应', need: '出现 JD 岗位名或核心产品', got: (text.includes(jd.role) || jd.keywords.some(k => text.includes(k))) ? '有' : '无', ok: true },
      ],
      gaps: [],
      missing: jd.keywords.filter(k => !hit(k, text)).slice(0, 12),
    });

    const total = Math.round(D.reduce((s, d) => s + d.score, 0) / D.length);
    const chars = totalChars;               // 与「总篇幅」同一口径

    /* ============================================================
       建议段：逐条对应上面的扣分点
       ============================================================ */
    const advice = [];
    D.forEach(d => {
      d.gaps.forEach(g => advice.push({
        from: d.name,
        t: `${g.item}没对上`,
        d: `JD 要求「${g.need}」，你简历里是「${g.got}」。${g.note}。`,
      }));
    });
    if (D[1].samples.length) {
      advice.push({ from: '成果可量化性', t: '把没数字的句子补上数据',
        d: `有 ${D[1].samples.length} 条经历没有任何量化结果。下面对比区里已经把这些句子改成带【】待填的模板，你把真实数字填进去就行——别编。` });
    }
    if (D[2].rows[0] && !D[2].rows[0].ok) {
      advice.push({ from: '语言专业度', t: '开头动词换成强动词',
        d: `「负责/参与/协助」只说明你到场了，不说明你做成了什么。改成「主导/搭建/推动/落地」这类动词，面试官一眼能看出你的角色。` });
    }
    if (D[2].missingTerms && D[2].missingTerms.length) {
      advice.push({ from: '语言专业度', t: '把 JD 的术语补进简历',
        d: `JD 里点名的「${D[2].missingTerms.slice(0, 4).join('、')}」，你简历里一次都没出现。HR 筛简历时搜的就是这些词——在相关句子里自然带出来，不是硬塞。` });
    }
    if (D[3].rows[0] && !D[3].rows[0].ok) {
      advice.push({ from: '篇幅合理性', t: D[3].rows[0].got.includes('字') && parseInt(D[3].rows[0].got) < 400 ? '内容太薄，补经历细节' : '砍掉冗余，控制在两页内',
        d: `现在 ${D[3].rows[0].got}。${parseInt(D[3].rows[0].got) < 400 ? '没有细节的简历等于没写。每个项目至少写清楚：背景、你做了什么、结果如何。' : '一页写不下 HR 会看不到第二页。合并同类项，删掉和岗位无关的。'}` });
    }
    if (D[4].rows[1] && !D[4].rows[1].ok) {
      advice.push({ from: '针对性', t: '个人评价要写给这个岗位看',
        d: '通用模板（"抗压能力强""认真负责"）对谁都一样，等于什么都没说。把开头两句换成 JD 里点名的职责 + 你对口的经验。' });
    }
    if (!advice.length) {
      advice.push({ from: '整体', t: '基础已经扎实', d: '五个维度都没有硬伤。接下来可以做两件事：把每条经历的成果数字再往细里拆（拆到能回答"怎么做到的"），以及针对这个 JD 再定制一版简历——同一份简历投所有岗位，HR 看得出来的。' });
    }

    return { dims: D, total, chars, advice, jd, resume: r };
  }

  /** 从经历时间段推算总工作年限（按月折算） */
  function calcYears(r) {
    const exps = r.experiences || [];
    if (!exps.length) return 0;
    let minT = Infinity, maxT = 0;

    const toT = (seg, isEnd) => {
      const t = String(seg || '').trim();
      if (!t) return null;
      if (/至今|现在|now/i.test(t)) {
        const n = new Date();
        return n.getFullYear() + n.getMonth() / 12;
      }
      const ym = t.match(/(20\d{2}|19\d{2})[.\-\/年]?\s*(\d{1,2})?/);
      if (!ym) return null;
      const y = Number(ym[1]);
      const mo = ym[2] ? Math.min(12, Number(ym[2])) : (isEnd ? 12 : 1);
      return y + (mo - 1) / 12;
    };

    exps.forEach(e => {
      const p = String(e.period || '');
      const parts = p.split(/\s*[-~—–至到]\s*/);
      const a = toT(parts[0], false);
      const b = parts.length > 1 ? toT(parts[1], true) : toT(parts[0], true);
      if (a !== null) minT = Math.min(minT, a);
      if (b !== null) maxT = Math.max(maxT, b);
    });

    if (!isFinite(minT) || !maxT || maxT <= minT) return 0;
    return Math.max(0, Math.round((maxT - minT) * 10) / 10);
  }

  /* ============================================================
     四、改写引擎
     ============================================================ */
  const VERB_UP = {
    '负责': { to: '主导', when: /从0到1|从 0 到 1|牵头|独立|设计|规划|搭建|从零|我/ },
    '参与': { to: '参与并交付', when: /负责|完成|独立|落地/ },
    '协助': { to: '配合推进', when: /完成|落地/ },
    '配合': { to: '协同', when: /完成|落地/ },
    '完成': { to: '交付', when: /报告|方案|设计|开发|任务|工作/ },
    '帮助': { to: '协助落地', when: /完成|提升|降低/ },
    '了解': { to: '研究并验证', when: /分析|验证/ },
    '熟悉': { to: '掌握', when: /使用|开发/ },
    '跟进': { to: '推进落地', when: /完成|上线/ },
    '维护': { to: '优化', when: /性能|效率|稳定|成本/ },
  };

  /** JD 术语 → 简历里更常见的说法（同义替换，不硬塞） */
  const TERM_SWAP = [
    ['用户研究', '用户调研'], ['A/B测试', 'A/B 测试'], ['转化率', '转化'],
    ['需求分析', '需求梳理'], ['数据驱动', '数据支撑'], ['产品规划', '产品规划'],
    ['指标体系', '数据指标'], ['跨部门', '跨团队'], ['留存率', '留存'],
  ];

  const DATE_RE = /(20\d{2}|19\d{2})[.\-\/年]?\s*(\d{1,2})?\s*月?\s*[-~—–至到]\s*(20\d{2}|19\d{2})[.\-\/年]?\s*(\d{1,2})?\s*月?|至今|现在/;

  /** 这一行是不是「公司/项目 + 岗位 + 时间」这种标题行 */
  function isTitleLine(t) {
    return DATE_RE.test(t) && t.length < 60;
  }

  /** 逐句改写 */
  function rewriteLine(ctx) {
    const { jd, sec, text, nextText } = ctx;
    const before = text;
    const notes = [];
    let after = text;

    // 1) 删口水话
    FILLER.forEach(f => {
      if (after.includes(f)) { after = after.split(f).join(''); notes.push(`删掉「${f}」`); }
    });

    // 2) 弱动词升级——没有主导性证据就不升级，避免替用户夸大
    for (const w in VERB_UP) {
      const rule = VERB_UP[w];
      if (new RegExp('^' + w).test(after)) {
        const rest = after.slice(w.length);
        if (rule.when.test(rest)) {
          after = rule.to + rest;
          notes.push(`「${w}」→「${rule.to}」`);
        } else if (w === '负责' || w === '完成' || w === '协助' || w === '配合') {
          after = (w === '负责' ? '负责并推进' : rule.to) + rest;
          notes.push(w === '负责' ? '「负责」→「负责并推进」（没看出你是主导，别硬升成"主导"）' : `「${w}」→「${rule.to}」`);
        }
      }
    }

    // 3) 术语同义替换：把简历里的说法换成 JD 用的词（不是硬塞）
    const flatBefore = before.replace(/\s+/g, '');
    for (const [jdTerm, plain] of TERM_SWAP) {
      if (flatBefore.includes(jdTerm)) continue;                 // 已经有了
      if (after.includes(plain)) {
        after = after.split(plain).join(jdTerm);
        notes.push(`「${plain}」→「${jdTerm}」，对齐 JD 用词`);
        break;
      }
    }

    // 4) 补量化
    if (!hasNumber(after) && (sec === 'work' || sec === 'proj')) {
      const m = after.match(/^(.*?)([，,、]?)(.*)$/);
      if (m && m[1].length > 4) {
        after = m[1] + '，使【指标】提升【X%】';
        notes.push('补量化结果：把【】里的换成真实数字');
      }
    }

    // 5) STAR 的 R：本人没写结果、下一行也没有结果时才补
    if ((sec === 'work' || sec === 'proj')
        && !RESULT_WORD.some(w => after.includes(w))
        && !(nextText && RESULT_WORD.some(w => nextText.includes(w)))) {
      after = after.replace(/[。.]$/, '') + '，最终【结果/数据】';
      notes.push('补 STAR 的 R（结果）');
    }

    // 6) 拆长句
    if (after.length > 60) {
      const parts = after.split(/[，,]/);
      let acc = '';
      const segs = [];
      parts.forEach(pt => {
        if ((acc + pt).length > 42 && acc) { segs.push(acc); acc = pt; }
        else acc += (acc ? '，' : '') + pt;
      });
      if (acc) segs.push(acc);
      if (segs.length > 1) { after = segs.join('。') + '。'; notes.push('拆成两句'); }
    }

    if (after === before) return { before, after: before, notes: ['这句没什么要改的'], changed: false };
    return { before, after, notes, changed: true };
  }

  /** 整体改写：返回按区块分组的对比数据 */
  function rewriteAll(jd, r) {
    const lines = resumeLines(r);
    const groups = [];
    const order = [
      { sec: 'work', name: '实习 / 工作经历' },
      { sec: 'proj', name: '项目经历' },
      { sec: 'edu', name: '教育背景' },
      { sec: 'skill', name: '技能' },
      { sec: 'other', name: '其他' },
    ];

    order.forEach(g => {
      const items = lines.filter(l => l.sec === g.sec);
      if (!items.length) return;
      const rows = items.map((l, i) => {
        // 标题行（公司/项目 + 时间）不参与改写
        if (isTitleLine(l.text)) {
          return { before: l.text, after: l.text, notes: ['标题行，不用改'], changed: false, skip: true };
        }
        const nextText = items[i + 1] ? items[i + 1].text : '';
        const rw = rewriteLine({ jd, sec: l.sec, text: l.text, nextText });
        return { before: rw.before, after: rw.after, notes: rw.notes, changed: rw.changed };
      });
      const shown = rows.filter(x => !x.skip);
      if (!shown.some(x => x.changed)) return;      // 整组没改就不展示
      groups.push({ name: g.name, rows: shown });
    });

    // 个人评价：整段重写成贴合 JD 的版本
    const evalLines = personalEval(r);
    if (evalLines.length) {
      const before = evalLines.join(' ');
      const after = rewritePersonal(before, jd, r);
      if (after !== before) {
        groups.unshift({
          name: '个人评价（整段重写）',
          rows: [{ before, after, notes: ['按 JD 职责重写，去掉通用模板'], changed: true, whole: true }],
        });
      }
    }
    return groups;
  }

  function rewritePersonal(before, jd, r) {
    const nbody = norm(resumeBodyText(r));
    const skillsAll = (r.skills || []);
    const rawBody = resumeBodyText(r);
    const tools = skillsAll
      .filter(s => TOOL_LEX.has(s))
      .sort((a, b) => rawBody.indexOf(a) - rawBody.indexOf(b))
      .slice(0, 3);
    const domains = skillsAll.filter(s => !TOOL_LEX.has(s)).slice(0, 2);
    const exps = (r.experiences || [])[0];
    const proj = (r.projects || [])[0];
    // 关键：只列「JD 里有、而且简历里真的出现过」的词。
    // 做不到的事绝不能写成"这几块我实际扛过"——那是在替用户吹牛。
    // 岗位名、专业名、泛名词要排除，否则会出现"「产品经理」——这几块我扛过"。
    const nrole = norm(jd.role || '');
    const duty = (jd.keywords || [])
      .filter(k => {
        if (!k || k.length < 2 || NOISE_TERMS.has(k)) return false;
        const nk = norm(k);
        if (nrole && nrole.includes(nk)) return false;
        if ((jd.majors || []).some(m => { const nm = norm(m); return nm && (nm.includes(nk) || nk.includes(nm)); })) return false;
        return nbody.includes(nk);
      })
      .slice(0, 3);
    const bits = [];

    if (exps) {
      const t = String(exps.title || '').replace(/\s+/g, ' ').trim();
      const sp = splitOrgRole(t, exps.role || '');
      if (sp.org && sp.role) bits.push(`在${sp.org}做${sp.role}`);
      else if (sp.role) bits.push(`做过${sp.role}`);
      else if (t) bits.push(`做过「${t}」`);
    }
    if (proj && proj.title) bits.push(`做过「${String(proj.title).trim()}」`);
    if (tools.length) bits.push(`用 ${tools.join('、')} 把事情做出来`);
    if (!tools.length && domains.length) bits.push(`做过的事主要集中在 ${domains.join('、')} 上`);
    if (duty.length) {
      bits.push(`与这个岗位对得上的地方是${duty.map(d => '「' + d + '」').join('、')}——这几块我实际扛过`);
    }
    if (tools.length) {
      bits.push(`熟悉 ${tools.join('、')}，习惯先把问题定位清楚再动手，做完会留下可复用的东西`);
    }
    if (!bits.length) {
      bits.push('（这段需要你自己补：写下你做过的最相关的一件事 + 结果 + 和这个岗位的关联）');
    }
    let out = bits.join('。');
    if (!/[。！？]$/.test(out)) out += '。';
    return out;
  }

  return { parseJD, evaluate, rewriteAll, rewritePersonal, resumeLines, personalEval, hasNumber, resumeBodyText, TOOL_LEX };
})();

window.Optimizer = Optimizer;


/* ==================== 页面交互（原 optimize-page.js） ==================== */

/* ============================================================
   职面通 · 简历优化页交互
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const jdTa = $('#op-jd');
  const rsTa = $('#op-rs');
  const jdTip = $('#op-jd-tip');
  const rsTip = $('#op-rs-tip');
  const errBox = $('#op-err');

  let jdText = '';
  let resumeObj = null;      // Resume.parse 的结果
  let resumeText = '';

  /* ---------- 文件上传 ---------- */
  function bindFile(btnSel, inputSel, ta, tip, isJD) {
    const btn = $(btnSel), input = $(inputSel);
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      tip.className = 'op-box__tip';
      tip.textContent = isJD ? '解析中…' : '正在解析简历…';
      try {
        if (isJD) {
          const r = await Resume.parse(f, (st) => { tip.textContent = st + '…'; });
          jdText = r.text;
          ta.value = r.text.slice(0, 20000);
          tip.className = 'op-box__tip is-ok';
          tip.textContent = `✓ 已读取 ${r.file}（${r.pages} 页 / ${r.chars} 字）`;
        } else {
          const r = await Resume.parse(f, (st) => { tip.textContent = st + '…'; });
          resumeObj = r;
          resumeText = r.text;
          ta.value = r.text.slice(0, 20000);
          tip.className = 'op-box__tip is-ok';
          tip.textContent = `✓ 已解析 ${r.file}：${r.education.length} 段教育 / ${r.experiences.length} 段经历 / ${r.projects.length} 个项目`;
        }
      } catch (err) {
        tip.className = 'op-box__tip is-err';
        tip.textContent = '✗ ' + (err && err.message ? err.message : '解析失败');
      }
    });
  }
  bindFile('#op-jd-file-btn', '#op-jd-file', jdTa, jdTip, true);
  bindFile('#op-rs-file-btn', '#op-rs-file', rsTa, rsTip, false);

  /* ---------- 粘贴内容也要能解析 ---------- */
  function buildResumeFromText(text) {
    if (resumeObj) return resumeObj;
    // 纯文本走 Resume 的结构化逻辑：用 File 技巧复用同一套解析
    const blob = new Blob([text], { type: 'text/plain' });
    const file = new File([blob], 'pasted.txt', { type: 'text/plain' });
    // Resume.parse 是异步的，但纯文本解析是同步的；这里直接同步构造
    return resumeFromTextSync(text);
  }

  /** 同步版：从纯文本构造结构化简历（不经过文件） */
  function resumeFromTextSync(text) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const SEC = [
      { re: /^(教育背景|教育经历|教育|学习经历)/, key: 'edu' },
      { re: /^(工作经历|工作经验|实习经历|实习|工作|职业经历)/, key: 'work' },
      { re: /^(项目经历|项目经验|项目|实践经历)/, key: 'proj' },
      { re: /^(专业技能|技能|技术能力|IT技能|个人技能)/, key: 'skill' },
      { re: /^(个人评价|自我评价|个人简介|职业评价|个人优势|自我描述)/, key: 'eval' },
    ];
    const bucket = { head: [], eval: [], edu: [], work: [], proj: [], skill: [], other: [] };
    let cur = 'head';
    for (const l of lines) {
      const hit = SEC.find(s => s.re.test(l));
      if (hit) { cur = hit.key; continue; }
      bucket[cur].push(l);
    }
    // 「个人评价」之后、下一个区块之前的，都算自评内容
    const evalLines = bucket.eval;

    const DATE = /(20\d{2}|19\d{2})[.\-\/年]?\s*(\d{1,2})?\s*月?\s*[-~—–至到]\s*(20\d{2}|19\d{2})[.\-\/年]?\s*(\d{1,2})?\s*月?|至今|现在/;

    /** 把一个区块按「带日期/角色的标题行」切成若干条目 */
    const groupEntries = (arr) => {
      const out = [];
      const STRONG = /(实习|工程师|专员|经理|设计师|运营|分析师|开发|策划|负责人|助理|总监|主管|研发|产品经理|项目经理)/;
      for (const l of arr) {
        const hasDate = DATE.test(l);
        const prev = out[out.length - 1];
        // 上一条还没内容、这一行几乎只有日期 → 那是上一条的续行，并进去
        if (prev && prev.bullets.length === 0 && hasDate &&
            l.replace(DATE, '').replace(/[\s|·\-—:：]/g, '').length <= 2) {
          prev.head = prev.head + ' ' + l;
          continue;
        }
        // 标题判定：有日期 / 本组第一行 / 上一条已有内容且这行像新角色（"负责…A/B 测试"不算）
        if (hasDate || !prev || (prev.bullets.length > 0 && STRONG.test(l))) {
          out.push({ head: l, bullets: [] });
        } else {
          prev.bullets.push(l);
        }
      }
      return out;
    };

    const workEntries = groupEntries(bucket.work);
    const projEntries = groupEntries(bucket.proj);

    const eduHead = bucket.edu.find(l => /大学|学院|学校/.test(l)) || bucket.edu[0] || '';
    const mEdu = eduHead.match(/([一-龥]{2,12}?(?:大学|学院|学校))/);
    const mDeg = eduHead.match(/(博士|硕士|研究生|本科|大专|专科)/);
    const mPer = eduHead.match(DATE);
    // 专业：按空格切段，取「学校」和「学历」之间的那一段
    let mMaj = eduHead.match(/([一-龥]{2,10}?)(?:专业|系)/);
    if (!mMaj) {
      const segs = eduHead.split(/[\s|,，]+/).filter(Boolean);
      const iSch = segs.findIndex(x => /大学|学院|学校/.test(x));
      const iDeg = segs.findIndex(x => /博士|硕士|研究生|本科|大专|专科/.test(x));
      if (iSch >= 0 && iDeg > iSch + 1) mMaj = { 1: segs.slice(iSch + 1, iDeg).join('') };
      else if (iSch >= 0 && segs[iSch + 1] && !/博士|硕士|研究生|本科|大专|专科/.test(segs[iSch + 1]) && !DATE.test(segs[iSch + 1])) {
        mMaj = { 1: segs[iSch + 1] };
      }
    }

    const experiences = workEntries.map(e => ({
      title: e.head.replace(DATE, '').replace(/[:：|]\s*$/, '').trim().slice(0, 40),
      role: (() => {
        const ms = e.head.match(/(实习生|工程师|专员|经理|设计师|运营|分析师|开发|测试|策划|负责人|助理|总监|主管|研发|产品经理)/g) || [];
        return ms.sort((a, b) => b.length - a.length)[0] || '';
      })(),
      period: (e.head.match(DATE) || [''])[0].replace(/\s+/g, ''),
      text: (e.head + '\n' + e.bullets.join('\n')).slice(0, 600),
      bullets: e.bullets,
    }));
    const projects = projEntries.map(e => ({
      title: e.head.replace(DATE, '').replace(/[:：|]\s*$/, '').trim().slice(0, 40),
      period: (e.head.match(DATE) || [''])[0].replace(/\s+/g, ''),
      text: (e.head + '\n' + e.bullets.join('\n')).slice(0, 600),
      bullets: e.bullets,
    }));

    // 硬技能（工具/方法）vs 软能力词（留存/沟通协调/增长…）：只有硬技能能说"我熟悉 X"
    const TOOLS = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'Rust', 'SQL', 'MySQL', 'Redis', 'MongoDB', 'Docker', 'Linux', 'Git', 'Excel', 'Figma', 'Axure', 'Tableau',
      'Photoshop', 'Illustrator', 'Premiere', 'PowerBI', 'SPSS', 'Eclipse', 'IntelliJ', 'VSCode', 'Spring', 'React',
      'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'Node.js', 'Express', 'NestJS', 'Django', 'Flask', 'Spark',
      'Hadoop', 'Hive', 'Matlab', 'AutoCAD', 'SolidWorks', 'Unity', 'Blender', 'SEO', 'SEM', 'Visio', 'Jira', '墨刀',
      'ProcessOn', 'AB测试', 'A/B测试', '需求分析', '竞品分析', '用户研究', '埋点', '数据分析', 'PMP', 'CFA', 'CPA'];
    const DOMAINS = ['投放', '增长', '留存', '转化', '招聘', '绩效', '薪酬', '财务', '预算', '成本', '报表', '审计',
      '跨部门', '沟通协调', '项目管理', '复盘', '汇报', '用户增长', '内容运营', '社群运营', '活动运营', '私域',
      'ROI', 'GMV', 'DAU', 'MAU', '转化率', '留存率', '客单价'];
    const lower = text.toLowerCase();
    const skills = TOOLS.filter(k => lower.includes(k.toLowerCase()))
      .concat(DOMAINS.filter(k => lower.includes(k.toLowerCase())));

    const firstLine = lines[0] || '';
    const nameM = firstLine.match(/^([一-龥]{2,4})(?![一-龥])/);
    const phone = text.match(/(?<!\d)(1[3-9]\d{9})(?!\d)/);
    const email = text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);

    return {
      ok: true, file: '粘贴内容', kind: 'text', pages: 1, chars: text.length, ms: 0,
      name: nameM ? nameM[1] : '',
      phone: phone ? phone[1] : '',
      email: email ? email[1] : '',
      education: mEdu ? [{ school: mEdu[1], degree: mDeg ? mDeg[1] : '', major: mMaj ? mMaj[1] : '', period: mPer ? mPer[0] : '' }] : [],
      experiences, projects,
      skills, earliestYear: 0,
      hasSection: { edu: bucket.edu.length > 0, work: workEntries.length > 0, proj: projEntries.length > 0, skill: bucket.skill.length > 0 },
      lines: {
        head: bucket.head,
        edu: bucket.edu, work: bucket.work, proj: bucket.proj,
        skill: bucket.skill, other: bucket.other,
        eval: evalLines,
      },
      text,
    };
  }

  /* ---------- 开始优化 ---------- */
  const opRunBtn = $('#op-run');
  const ENGINE_NOTE = {
    ai: 'AI 模式：改写与建议由大模型生成，硬性条件比对与五维评分仍走本地规则（可逐条复核）。',
    local: '本页由浏览器内的规则引擎驱动（关键词与结构信号判定，非大模型）。每条结论都标了依据，可以逐条复核；【】里的数字需要你自己填真实值，别编。',
    fallback: 'AI 调用失败，已自动回退到本地规则引擎。',
  };

  function setRunBusy(busy) {
    opRunBtn.disabled = busy;
    opRunBtn.textContent = busy ? '优化中…' : '开始优化';
  }

  function setEngineNote(kind) {
    const n1 = $('#op-engine-note');
    const n2 = $('#op-engine-note-2');
    const text = ENGINE_NOTE[kind] || ENGINE_NOTE.local;
    if (n1) n1.textContent = text;
    if (n2 && kind === 'ai') {
      n2.textContent = '改写同样由大模型生成，硬性条件与评分仍来自本地规则；【】里的数字得你补真实值。';
    }
  }

  opRunBtn.addEventListener('click', async () => {
    errBox.hidden = true;
    const jd = (jdText && jdTa.value === jdText) ? jdText : jdTa.value.trim();
    const rs = (resumeText && rsTa.value === resumeText) ? resumeText : rsTa.value.trim();

    if (!jd) { fail('先填岗位 JD'); jdTa.focus(); return; }
    if (!rs) { fail('再填个人简历'); rsTa.focus(); return; }

    const r = (resumeObj && rsTa.value === resumeText) ? resumeObj : resumeFromTextSync(rs);
    const jdObj = Optimizer.parseJD(jd);
    const result = Optimizer.evaluate(jdObj, r);
    const groups = Optimizer.rewriteAll(jdObj, r);

    // AI 优先：改写与建议交给大模型，硬性条件与评分留在本地（可复核、不黑箱）
    if (window.LLM && LLM.state.ai) {
      setRunBusy(true);
      try {
        const ai = await LLM.resume(buildResumePayload(jd, r));
        const merged = mergeResumeAI(result, groups, r, ai);
        render(merged.result, merged.groups, jdObj, r);
        gotoStep(2);
        setEngineNote('ai');
        return;
      } catch (e) {
        setEngineNote('fallback');
      } finally {
        setRunBusy(false);
      }
    }

    render(result, groups, jdObj, r);
    gotoStep(2);
  });

  /** 组装发给后端的简历载荷：逐句带全局序号，方便模型按序号回指 */
  function buildResumePayload(jd, r) {
    return {
      jd,
      resume: {
        skills: r.skills || [],
        education: r.education || [],
        experiences: r.experiences || [],
        projects: r.projects || [],
        lines: Optimizer.resumeLines(r).map(l => ({ idx: l.idx, sec: l.sec, text: l.text })),
        eval: Optimizer.personalEval(r),
      },
    };
  }

  /** 把 AI 的改写/建议并进本地结果：评分与硬性条件用本地，建议与改后用 AI */
  function mergeResumeAI(result, groups, r, ai) {
    const res = { ...result };
    if (ai && ai.advice && ai.advice.length) res.advice = ai.advice;
    const aiGroups = groupsFromAI(r, ai);
    return { result: res, groups: aiGroups.length ? aiGroups : groups };
  }

  const SEC_ORDER = [
    { sec: 'work', name: '实习 / 工作经历' },
    { sec: 'proj', name: '项目经历' },
    { sec: 'edu', name: '教育背景' },
    { sec: 'skill', name: '技能' },
    { sec: 'other', name: '其他' },
  ];

  /** AI 返回的逐句改写 → 渲染用的分组对比结构；改前永远取本地原文，不信任模型的回显 */
  function groupsFromAI(r, ai) {
    if (!ai || !ai.lines) return [];
    const all = Optimizer.resumeLines(r);
    const byIdx = new Map(all.map(l => [l.idx, l]));
    const bySec = {};
    (ai.lines || []).forEach(item => {
      const idx = Number(item.idx);
      const line = byIdx.get(idx);
      if (!line || line.sec !== item.sec) return;              // 越界或区块不符，丢弃
      const after = String(item.after || '').trim();
      if (!after || after === line.text) return;               // 没改就不展示
      if (!bySec[item.sec]) bySec[item.sec] = [];
      bySec[item.sec].push({
        before: line.text,
        after,
        notes: (item.notes && item.notes.length) ? item.notes : ['大模型改写'],
        changed: true,
      });
    });

    const groups = [];
    SEC_ORDER.forEach(g => { if (bySec[g.sec] && bySec[g.sec].length) groups.push({ name: g.name, rows: bySec[g.sec] }); });

    const personal = String((ai.personal || '')).trim();
    const evalLines = Optimizer.personalEval(r);
    if (personal && evalLines.length && personal !== evalLines.join(' ')) {
      groups.unshift({
        name: '个人评价（整段重写）',
        rows: [{ before: evalLines.join(' '), after: personal, notes: ['大模型按 JD 重写'], changed: true, whole: true }],
      });
    }
    return groups;
  }

  function fail(msg) {
    errBox.hidden = false;
    errBox.textContent = msg;
  }

  function gotoStep(n) {
    $$('.op-step').forEach(el => el.classList.toggle('is-on', el.dataset.step === String(n)));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------- 渲染报告 ---------- */
  function render(res, groups, jd, r) {
    $('#rp-role').textContent = jd.role || '目标岗位';
    $('#rp-sub').textContent = `简历 ${res.chars} 字 · ${(r.experiences || []).length} 段经历 · ${(r.projects || []).length} 个项目 · ${(r.skills || []).length} 项技能`;
    $('#rp-total').textContent = res.total;
    const lv = res.total >= 85 ? '高度匹配' : res.total >= 70 ? '基本匹配' : res.total >= 55 ? '差距明显' : '需要重写';
    $('#rp-total-l').textContent = `综合匹配度 · ${lv}`;

    /* 维度 */
    $('#rp-dims').innerHTML = res.dims.map(d => {
      const rows = (d.rows || []).map(rw => {
        const cls = rw.ok === true ? 'is-good' : (rw.ok === false ? 'is-bad' : '');
        const tag = rw.ok === true ? '达标' : (rw.ok === false ? '不达标' : '');
        return `<div class="rp-row ${cls}">
          <span class="rp-row__k">${esc(rw.item)}</span>
          <span class="rp-row__v">${esc(rw.need)} → <b>${esc(rw.got)}</b>${tag ? `<span class="rp-row__tag">${tag}</span>` : ''}</span>
        </div>`;
      }).join('');
      const samples = (d.samples && d.samples.length)
        ? `<div class="rp-samples"><p class="rp-samples__h">这些句子缺数据</p><ul>${d.samples.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '';
      const miss = (d.missing && d.missing.length)
        ? `<div class="rp-samples"><p class="rp-samples__h">JD 里出现、但简历里没有的词</p>
           <div class="rp-kw">${d.missing.map(m => `<b>${esc(m)}</b>`).join('')}</div></div>` : '';
      return `<li class="rp-dim ${d.key === 'hard' ? 'rp-dim--wide' : ''}">
        <div class="rp-dim__top">
          <span class="rp-dim__name">${esc(d.name)}</span>
          <span class="rp-dim__score">${d.score}<i>/100</i></span>
        </div>
        <div class="rp-bar ${d.score < 60 ? 'is-low' : ''}"><span style="width:${d.score}%"></span></div>
        <p class="rp-dim__desc">${esc(d.desc)}</p>
        ${rows ? `<div class="rp-rows">${rows}</div>` : ''}
        ${samples}${miss}
      </li>`;
    }).join('');

    /* 建议 */
    $('#rp-advice').innerHTML = res.advice.map(a => `
      <li>
        <span class="rp-advice__from">${esc(a.from)}</span>
        <p class="rp-advice__t2">${esc(a.t)}</p>
        <p class="rp-advice__d2">${esc(a.d)}</p>
      </li>`).join('');

    /* 改前改后 */
    // 统计口径：扫了多少句（全部正文句）、其中多少句要改
    const scanned = Optimizer.resumeLines(r).length;
    const changedRows = groups.reduce((s2, g) => s2 + g.rows.filter(x => x.changed).length, 0);
    const stat = `<p class="rp-diff__stat">扫了 <b>${scanned}</b> 句正文，其中 <b>${changedRows}</b> 句按规则需要改。没被改的句子是规则没发现毛病，不是「一定没问题」——自己再读一遍。</p>`;

    if (!groups.length) {
      $('#rp-diff').innerHTML = stat + `<p class="rp-empty">按当前规则没有发现需要改写的句子。</p>`;
    } else {
      $('#rp-diff').innerHTML = groups.map(g => {
        const rows = g.rows.map(row => {
          const notes = (row.notes || []).map(n => `<span>${esc(n)}</span>`).join('');
          return `<div class="rp-cmp">
            <div class="rp-cmp__c rp-cmp__c--new">
              <p class="rp-cmp__l">改后</p>
              <p class="rp-cmp__t">${highlight(row.after)}</p>
              ${notes ? `<div class="rp-cmp__notes">${notes}</div>` : ''}
            </div>
            <div class="rp-cmp__c rp-cmp__c--old">
              <p class="rp-cmp__l">改前</p>
              <p class="rp-cmp__t">${esc(row.before)}</p>
            </div>
          </div>`;
        }).join('');
        return `<div class="rp-dg">
          <div class="rp-dg__h">
            <b>${esc(g.name)}</b>
            <span>${g.rows.length} 句</span>
            <span class="rp-dg__legend">
              <i class="l-new">改后</i><i class="l-old">改前</i>
            </span>
          </div>
          ${rows}
          <p class="rp-dg__foot">【】里的内容需要你填真实数据——编的数字会在面试里被问穿。</p>
        </div>`;
      }).join('');
      $('#rp-diff').innerHTML = stat + $('#rp-diff').innerHTML;
    }
  }

  /** 把【】待填内容高亮出来 */
  function highlight(t) {
    return esc(t).replace(/【([^】]*)】/g, '<mark>【$1】</mark>');
  }

  /* ---------- 再改一版 ---------- */
  $('#op-again').addEventListener('click', () => {
    gotoStep(1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  });

  /* 启动时如果 URL 带 ?role= 预填岗位（从首页功能卡进来用） */
  const q = new URLSearchParams(location.search);
  if (q.get('jd')) jdTa.value = q.get('jd').slice(0, 2000);

  /* 引擎探测：后端在则标 AI 模式，改写与建议走大模型 */
  if (window.LLM) {
    LLM.probe().then(() => setEngineNote(LLM.state.ai ? 'ai' : 'local'));
  }
})();
