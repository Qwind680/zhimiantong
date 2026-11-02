/* ============================================================
   职面通 · 简历解析
   ------------------------------------------------------------
   纯前端，零后端：
     PDF  → pdf.js (pdfjs-dist 4.7)
     DOCX → mammoth.js
     TXT  → 直接读
   抽取后做结构化（教育 / 经历 / 项目 / 技能），供出题与评分使用。
   ============================================================ */

const Resume = (() => {
  'use strict';

  const V = 'assets/vendor/';
  let _pdf = null, _mammoth = false;

  /* ---------- 懒加载解析库 ---------- */
  function loadPdf() {
    if (_pdf) return Promise.resolve(_pdf);
    // 用 UMD classic 构建：file:// 双击打开也能加载，动态 import(ESM) 在 file:// 下会被 CORS 拦死
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = V + 'pdf.min.js';
      s.onload = () => {
        const lib = window.pdfjsLib;
        if (!lib) { rej(new Error('PDF 引擎加载失败')); return; }
        lib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.js';
        _pdf = lib;
        res(lib);
      };
      s.onerror = () => rej(new Error('PDF 引擎加载失败，请重试或换用 DOCX / 图片'));
      document.head.appendChild(s);
    });
  }
  function loadMammoth() {
    if (_mammoth) return Promise.resolve(true);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = V + 'mammoth.browser.min.js';
      s.onload = () => { _mammoth = true; res(true); };
      s.onerror = () => rej(new Error('mammoth 加载失败'));
      document.head.appendChild(s);
    });
  }

  /* ---------- 取纯文本 ---------- */
  async function extractText(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const t0 = performance.now();

    if (ext === 'pdf') {
      const pdfjs = await loadPdf();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const c = await page.getTextContent();
        // 按 y 坐标分行，避免整页糊成一行
        let last = null, line = [], lines = [];
        for (const it of c.items) {
          const y = it.transform[5];
          if (last === null || Math.abs(y - last) < 3) line.push(it.str);
          else { lines.push(line.join('')); line = [it.str]; }
          last = y;
        }
        if (line.length) lines.push(line.join(''));
        pages.push(lines.join('\n'));
      }
      const text = pages.join('\n\n');
      // 扫描件（图片型 PDF）抽不出文字，交给 AI 识别
      return { text, pages: doc.numPages, ext, ms: performance.now() - t0, needsOCR: !text.trim() };
    }

    if (ext === 'docx') {
      await loadMammoth();
      const buf = await file.arrayBuffer();
      const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
      return { text: r.value, pages: 1, ext, ms: performance.now() - t0 };
    }

    if (ext === 'txt' || ext === 'md') {
      const text = await file.text();
      return { text, pages: 1, ext, ms: performance.now() - t0 };
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
      // 图片没有本地可抽的文本，交给 AI 视觉识别
      return { text: '', pages: 1, ext, ms: performance.now() - t0, needsOCR: true };
    }

    throw new Error('暂不支持这种格式，请上传 PDF / Word / txt / 图片');
  }

  /* ---------- 结构化抽取 ---------- */
  const RE = {
    phone:  /(?<!\d)(1[3-9]\d{9})(?!\d)/,
    email:  /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/,
    period: /(20\d{2}|19\d{2})\s*[.\-/年]\s*(\d{1,2})?\s*月?\s*[-~—–至到]\s*(至今|现在|now|(20\d{2}|19\d{2})\s*[.\-/年]?\s*(\d{1,2})?\s*月?)/g,
    school: /([一-龥A-Za-z]{2,12}?(?:大学|学院|学校|大专))/,
    degree: /(博士|硕士|本科|大专|专科|研究生|MBA)/,
    section: /(教育背景|教育经历|教育|工作经历|工作经验|实习经历|实习|项目经历|项目经验|项目|专业技能|技能|个人总结|自我评价|荣誉|获奖|证书)/g,
  };

  const SKILL_LEX = [
    // 语言 / 框架
    'JavaScript','TypeScript','Python','Java','Go','C++','C#','Ruby','PHP','Swift','Kotlin','Rust','SQL','HTML','CSS','React','Vue','Angular','Svelte','Next.js','Nuxt','Node.js','Express','NestJS',
    // 数据 / 存储
    'MySQL','PostgreSQL','Redis','MongoDB','Elasticsearch','Kafka','RabbitMQ','SQLite','Oracle','Hive','Spark','Hadoop','Flink','ClickHouse',
    // 云 / 运维
    'Docker','Kubernetes','K8s','CI/CD','Jenkins','Git','Linux','Nginx','AWS','阿里云','腾讯云','监控','Prometheus',
    // 产品 / 设计
    'Axure','Figma','Sketch','墨刀','用户研究','竞品分析','需求分析','原型','交互','PRD','埋点','A/B测试','增长','用户画像',
    // 运营 / 增长
    'SEO','SEM','投放','私域','社群','活动策划','文案','数据分析','BI','指标体系','留存','转化率','GMV','ROI',
    // 职能
    '财务','预算','成本','报表','审计','Excel','PPT','Tableau','Power BI','招聘','绩效','劳动关系','薪酬','SOP','跨部门','项目管理','时间管理',
    // 通用素质
    '沟通','协作','抗压','复盘','汇报','抗压能力','团队管理','目标拆解',
  ];

  const SECTION_MAP = {
    '教育背景':'edu','教育经历':'edu','教育':'edu',
    '工作经历':'work','工作经验':'work','实习经历':'work','实习':'work',
    '项目经历':'proj','项目经验':'proj','项目':'proj',
    '专业技能':'skill','技能':'skill',
  };

  function splitSections(text) {
    const marks = [];
    RE.section.lastIndex = 0;
    let m;
    while ((m = RE.section.exec(text))) {
      // 标题必须出现在行首，否则说明它是正文里顺带提到的词
      // （PDF 常把「实习经历」拆成「实习\n经历」，只匹配到「实习」会切出多余区块）
      const before = text.slice(0, m.index);
      const atLineStart = before === '' || /[\n\r]\s*$/.test(before) || before.length <= 4;
      if (!atLineStart) continue;
      const name = m[1];
      marks.push({ name, key: SECTION_MAP[name] || 'other', at: m.index, end: m.index + name.length });
    }
    const out = { edu: [], work: [], proj: [], skill: [], other: [], head: text.slice(0, marks.length ? marks[0].at : Math.min(text.length, 800)) };
    marks.forEach((k, i) => {
      const body = text.slice(k.end, i + 1 < marks.length ? marks[i + 1].at : text.length).trim();
      if (!body) return;
      out[k.key].push({ name: k.name, body });
    });
    // 逐行保留原始语句：改前改后对比要按句对齐，不能只留结构化结果
    out.lines = {
      head: splitLines(out.head),
      edu: out.edu.flatMap(s => splitLines(s.body)),
      work: out.work.flatMap(s => splitLines(s.body)),
      proj: out.proj.flatMap(s => splitLines(s.body)),
      skill: out.skill.flatMap(s => splitLines(s.body)),
      other: out.other.flatMap(s => splitLines(s.body)),
    };
    return out;
  }

  function splitLines(body) {
    return String(body || '').split('\n').map(s => s.trim()).filter(Boolean);
  }

  function parseProject(body) {
    const lines = body.split('\n').map(s => s.trim()).filter(Boolean);
    const head = lines[0] || '';
    const pm = head.match(RE.period);
    const sm = head.match(RE.school);
    return {
      title: head.replace(RE.period, '').replace(/[:：|·\s]+$/, '').replace(/[:：|].*$/, '').trim().slice(0, 40),
      org: sm ? sm[1] : '',
      period: pm ? pm[0].replace(/\s+/g, '') : '',
      text: body.slice(0, 600),
    };
  }

  function parseWork(body) {
    const lines = body.split('\n').map(s => s.trim()).filter(Boolean);
    const head = lines[0] || '';
    const pm = head.match(RE.period);
    // 取最长匹配：「产品经理实习生」不能只截成「经理」
    const roleMs = head.match(/(实习生|工程师|专员|经理|主管|设计师|运营|分析师|顾问|助理|负责人|总裁|开发|测试|策划|BD|HRBP|架构师|产品经理|项目经理)/g) || [];
    const roleM = roleMs.sort((a, b) => b.length - a.length)[0];
    return {
      title: head.replace(RE.period, '').replace(/[:：|·\s]+$/, '').replace(/[:：|].*$/, '').trim().slice(0, 40),
      role: roleM || '',
      period: pm ? pm[0].replace(/\s+/g, '') : '',
      text: body.slice(0, 600),
    };
  }

  function parseEdu(body) {
    const lines = body.split('\n').map(s => s.trim()).filter(Boolean);
    const head = lines[0] || '';
    const sm = head.match(RE.school);
    const dm = body.match(RE.degree);
    const pm = head.match(RE.period);
    const majorM = body.match(/([一-龥]{2,10}?)(?:专业|系)/);
    return {
      school: sm ? sm[1] : head.slice(0, 20),
      degree: dm ? dm[1] : '',
      major: majorM ? majorM[1] : '',
      period: pm ? pm[0].replace(/\s+/g, '') : '',
    };
  }

  /* ---------- 主入口 ---------- */
  async function parse(file, onStage) {
    const stage = onStage || (() => {});
    stage('读取文件');
    let ex = await extractText(file);
    stage('解析结构');

    // 本地抽不出文字（扫描件 PDF / 图片）→ 走 AI 视觉识别
    if (ex.needsOCR || !String(ex.text || '').trim()) {
      if (window.LLM) {
        stage('AI 识别');
        try {
          const ocr = await window.LLM.ocr(file, file.name, file.type);
          if (ocr && ocr.text) ex = { ...ex, text: ocr.text, ocr: true };
        } catch (e) {
          throw new Error('AI 识别失败：' + (e && e.message ? e.message : '请检查后端是否启动并配好密钥'));
        }
      } else {
        throw new Error('没读到文字，可能是扫描件（图片型 PDF）。识别这类文件需要连接后端：先跑 server/index.js 并配好密钥。');
      }
    }

    // NFKC 归一化：不少 PDF 字体会把「大」「项」「目」编码成康熙部首
    // （⼤ U+2F24 / ⼬ U+2F2C）。不归一化的话，「项目经历」这类区块
    // 标题根本匹配不上，结构化会整段丢失。
    const text = ex.text.normalize('NFKC').replace(/ /g, ' ').replace(/[ \t]{2,}/g, ' ');
    if (!text.trim()) throw new Error('没读到文字，可能是扫描件（图片型 PDF），请换成可复制文字的版本');

    const sec = splitSections(text);

    const education = sec.edu.map(s => parseEdu(s.body)).filter(x => x.school);
    const experiences = sec.work.map(s => parseWork(s.body));
    const projects = sec.proj.map(s => parseProject(s.body));

    stage('识别技能');
    const lower = text.toLowerCase();
    const skills = Array.from(new Set(
      SKILL_LEX.filter(s => lower.includes(s.toLowerCase()))
    )).slice(0, 14);

    // 姓名：第一行里像中文名的部分
    const firstLine = (sec.head || text).split('\n').map(s => s.trim()).find(Boolean) || '';
    const nameM = firstLine.match(/^([一-龥]{2,4})(?![一-龥])/);
    const phone = text.match(RE.phone);
    const email = text.match(RE.email);

    // 简历里出现最多的年份 → 推断求职年限
    const years = Array.from(new Set((text.match(/20(1[5-9]|2[0-6])/g) || []))).sort();
    const earliest = years.length ? Math.min(...years.map(Number)) : 0;

    stage('完成');
    return {
      ok: true,
      lines: sec.lines,
      file: file.name,
      kind: ex.ext,
      pages: ex.pages,
      chars: text.length,
      ms: Math.round(ex.ms),
      name: nameM ? nameM[1] : '',
      phone: phone ? phone[1] : '',
      email: email ? email[1] : '',
      education, experiences, projects, skills,
      earliestYear: earliest || 0,
      hasSection: { edu: sec.edu.length > 0, work: sec.work.length > 0, proj: sec.proj.length > 0, skill: sec.skill.length > 0 },
      text: text.slice(0, 20000),
    };
  }

  /* ---------- 简历 → 面试上下文 ---------- */
  function toContext(r) {
    if (!r || !r.ok) return null;
    return {
      name: r.name,
      skills: r.skills,
      projects: r.projects.map(p => ({ title: p.title, text: p.text })).slice(0, 3),
      experiences: r.experiences.map(e => ({ title: e.title, role: e.role })).slice(0, 3),
      education: r.education.slice(0, 2),
    };
  }

  return { parse, toContext, SKILL_LEX };
})();

window.Resume = Resume;
