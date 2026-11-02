/* ============================================================
   职面通 · 模拟面试题库与岗位解析
   方法论来源：interview-question-generator
   - 题型五分：行为(STAR) / 情景 / 专业 / 文化匹配 / 压力
   - 岗位分族：技术·产品运营·销售·市场·管理·管培·财务·行政·通用
   - 每题带：考察点 hint、追问两轮 f、考察维度 d
   ============================================================ */

/* ---------- 岗位分族定义（对应 job-types.md） ---------- */
const FAMILIES = {
  tech: {
    label: '技术 / 研发',
    focus: '专业知识深度、项目经验真实性、问题解决、技术学习',
    kw: ['代码','需求','系统','接口','性能','架构','上线','bug','重构','测试','部署','数据库','缓存','算法','组件','服务','监控','技术选型','前端','后端','算法','数据','模型','开发','报错','排查','模块','并发','优化'],
  },
  product: {
    label: '产品 / 运营',
    focus: '业务理解、逻辑严密性、数据分析、跨部门协作、用户洞察',
    kw: ['需求','用户','数据','指标','上线','竞品','转化','留存','增长','渠道','运营','活动','反馈','迭代','优先级','方案','功能','场景','拉新','复盘','埋点'],
  },
  sales: {
    label: '销售 / 商务',
    focus: '沟通表达、客户关系、谈判、抗压韧性、业绩导向',
    kw: ['客户','成交','签单','业绩','谈判','报价','渠道','线索','回款','复购','大客户','需求','方案','合同','预算','续约','销售'],
  },
  marketing: {
    label: '市场 / 营销',
    focus: '市场洞察、创意策划、数据分析、项目执行、资源整合',
    kw: ['品牌','投放','渠道','活动','传播','内容','预算','roi','拉新','曝光','转化','物料','创意','增长','用户','传播','社群','私域'],
  },
  management: {
    label: '管理 / 负责人',
    focus: '团队领导力、战略思维、人才培养、绩效管理、变革推动',
    kw: ['团队','目标','绩效','培养','招聘','排兵','汇报','跨部门','梯队','分工','带人','向上','优先级','资源','协同','落地','机制'],
  },
  campus: {
    label: '管培 / 校招生',
    focus: '学习能力、成长潜力、价值观匹配、逻辑思维、主动性',
    kw: ['实习','校园','社团','课程','毕业','学习','成长','实践','比赛','作业','团队','课程','经历','能力','目标','规划','项目','学校'],
  },
  finance: {
    label: '财务 / 金融',
    focus: '专业深度、数据敏感、风险与合规意识、细致严谨',
    kw: ['报表','成本','预算','账','审计','合规','报销','现金流','税务','结账','凭证','对账','费用','利润','核算','数据'],
  },
  admin: {
    label: '行政 / 支持',
    focus: '细节把控、多任务管理、服务意识、沟通协调、应急处理',
    kw: ['行政','会议','差旅','办公','物资','协调','接待','排期','后勤','场地','签到','报销','采购','通知','场地','物资'],
  },
  general: {
    label: '通用岗位',
    focus: '综合能力、动机匹配、表达与逻辑',
    kw: ['工作','项目','团队','目标','计划','沟通','问题','时间','能力','经验','学习','结果','负责','安排','完成'],
  },
};

/* ---------- 岗位输入 → 分族 / 职级 / 关键词 ---------- */
const FAMILY_HINTS = [
  ['tech',        ['开发','前端','后端','算法','测试','运维','数据','全栈','java','python','react','vue','安卓','ios','算法工程师','架构']],
  ['product',     ['产品','运营','增长','用户','策划']],
  ['sales',       ['销售','商务','bd','客户成功','售前','招商']],
  ['marketing',   ['市场','营销','品牌','投放','公关','内容']],
  ['management',  ['经理','主管','负责人','总监','leader','管理']],
  ['campus',      ['管培','校招','应届','毕业生','储备','管培生','实习']],
  ['finance',     ['财务','金融','会计','审计','风控','税务']],
  ['admin',       ['行政','人事','hr','后勤','支持']],
];

const LEVEL_HINTS = [
  ['管理', ['经理','主管','总监','负责人','leader','head','chief']],
  ['高级', ['高级','资深','专家','principal','staff','架构师']],
  ['中级', ['中级','senior','工程师','专员']],
  ['初级', ['初级','应届','实习','校招','管培','助理','jnr','实习']],
];

function parseJob(raw) {
  const text = (raw || '').trim();
  const low = text.toLowerCase();

  let family = 'general';
  for (const [key, hints] of FAMILY_HINTS) {
    if (hints.some(h => low.includes(h))) { family = key; break; }
  }

  let level = '中级';
  for (const [lv, hints] of LEVEL_HINTS) {
    if (hints.some(h => low.includes(h))) { level = lv; break; }
  }

  // 关键词：分族词表中「岗位名里出现过的」优先，再补充分族高频词，
  // 至少保底 5 个 —— 太少会让相关性判定失去参照。
  const pool = FAMILIES[family].kw;
  const hits = pool.filter(k => low.includes(k));
  const keywords = Array.from(new Set([...hits, ...pool.slice(0, 5)])).slice(0, 7);

  return { name: text || '未命名岗位', family, level, keywords, focus: FAMILIES[family].focus };
}

/* ---------- 题型 ---------- */
const TYPES = {
  behavior: { label: '行为面试题', abbr: '行为题', method: 'STAR：情境 → 任务 → 行动 → 结果' },
  scenario: { label: '情景模拟题', abbr: '情景题', method: '场景 + 约束 + 决策点' },
  pro:      { label: '专业知识题', abbr: '专业题', method: '核心技能 + 深入追问' },
  culture:  { label: '文化匹配题', abbr: '文化题', method: '动机、协作、抗挫' },
  stress:   { label: '压力面试题', abbr: '压力题', method: '就事论事，2–3 轮后转场' },
};

/* ---------- 题库 ----------
   t  : 题干
   hint: 考察点
   f  : 两轮追问（对应「同一题最多追问 2 次」）
   d  : 主要考察维度（专业度/表达/逻辑/应变）
------------------------------------------------------- */
const BANK = {
  tech: {
    behavior: [
      { t: '讲一个你排查过最难的线上问题。从现象、定位到修复，把过程说一遍。',
        hint: 'STAR 四要素是否齐全，重点看定位过程', d: '逻辑',
        f: ['你定位到根因用了多长时间？中间试过哪些方向是错的？', '修复之后你怎么确认它真的好了，而不是刚好没复现？'] },
      { t: '你推动过的一次技术改进是什么？为什么团队会同意改？',
        hint: '警惕「我们」代替「我」，追问个人贡献', d: '表达',
        f: ['这件事里，哪一部分是你自己决定并推动的？', '改进之后有数据吗？比如开发时长、故障率、迭代速度。'] },
      { t: '讲一次你写的代码被别人挑出问题、不得不重写的经历。',
        hint: '接受批评与修正能力', d: '应变',
        f: ['对方指出的是什么问题？', '你重写之后怎么确认改对了？'] }
    ],
    scenario: [
      { t: '下周就要上线，但联调时你发现有一个模块必须重构，否则带着已知问题发版。你怎么做？',
        hint: '决策点：发版还是延期', d: '应变',
        f: ['你怎么向上同步这个风险？第一句话会怎么说？', '如果老板说必须按时发，你的下一步是什么？'] },
      { t: '产品和测试对同一个功能的理解不一致，都认为该按自己的来，都要你改。怎么处理？',
        hint: '跨角色冲突处理', d: '应变',
        f: ['你当时是怎么把两个人的分歧具体化的？', '最后采纳了谁的意见，判断依据是什么？'] },
      { t: '产品下周要上一个新功能，但按现有架构写要两周。你怎么办？',
        hint: '技术约束下的取舍', d: '逻辑',
        f: ['你会怎么和产品谈？拿什么依据谈？', '如果产品不肯砍，你愿意承担哪部分风险？'] }
    ],
    pro: [
      { t: '你负责的一个接口突然变慢了一倍。从哪些方向、按什么顺序排查？',
        hint: '排查路径的完整性与优先级排序', d: '专业度',
        f: ['第一步你先看哪个指标？为什么先看它？', '如果监控面板上看不出异常，你下一步做什么？'] },
      { t: '什么时候你会主动引入一个新库或新框架？举一个你决定「不引入」的例子。',
        hint: '技术选型决策与取舍', d: '逻辑',
        f: ['不引入的那个，你当时给了什么替代方案？', '怎么让别人接受你「不引入」的判断？'] },
      { t: '你怎么保证你写的代码别人能接手？',
        hint: '可维护性与协作规范', d: '专业度',
        f: ['你会做哪些事让别人好接手？', '上一次有人接手你的东西，出了什么问题？'] }
    ],
    culture: [
      { t: '说一个你在团队里主动暴露问题、而不是自己扛着的问题。',
        hint: '诚实度与协作意识', d: '表达',
        f: ['暴露之后团队的氛围有变化吗？', '如果当时藏下来，短期看是不是更省事？'] },
      { t: '说一次你主动去请教别人的经历，问了谁、问了什么。',
        hint: '学习主动性', d: '表达',
        f: ['你为什么决定去问他？', '问完之后你做了什么改变？'] }
    ],
    stress: [
      { t: '如果你的方案上线后引发线上事故，你第一时间做什么？',
        hint: '抗压与优先级判断', d: '应变',
        f: ['先止损还是先定位？说清楚你的顺序。', '你会怎么向你的直属同步？第一句说什么？'] },
    ],
  },

  product: {
    behavior: [
      { t: '讲一个你从数据里发现问题、最后落地解决的过程。',
        hint: '数据 → 假设 → 验证 → 落地闭环', d: '逻辑',
        f: ['你看到的是哪个指标？当时掉了多少？', '你排除了哪些可能，才认定是这个原因？'] },
      { t: '说一次你主动放弃某个需求的经历。后来你怎么看这个决定？',
        hint: '取舍判断与复盘能力', d: '逻辑',
        f: ['放弃的时候有没有人反对？你怎么说服他的？', '如果重新来一次，你会在什么条件下重新做这个需求？'] },
      { t: '讲一次你砍掉或推迟一个需求的经历。',
        hint: '取舍判断与后续验证', d: '逻辑',
        f: ['你砍的时候用什么标准？', '上线后你回头验证过这个决定吗？'] }
    ],
    scenario: [
      { t: '核心转化率突然掉了 20%，你怎么排查？',
        hint: '拆解指标链路', d: '逻辑',
        f: ['你会按什么顺序排除？先看数据还是先看发布记录？', '如果一周内没找到原因，你怎么向上汇报？'] },
      { t: '开发说排期做不完，只能做一半。你怎么和他谈？',
        hint: '需求裁剪与跨团队谈判', d: '表达',
        f: ['你打算砍哪一半？判断依据是什么？', '如果他说这一半也不能砍呢？'] },
      { t: '上线前一天发现核心流程有 bug，但不影响主流程。你发不发？',
        hint: '发布决策与风险承担', d: '应变',
        f: ['你的判断依据是什么？', '你怎么跟用户和老板同步这个决定？'] }
    ],
    pro: [
      { t: '你怎么判断一个功能值不值得做？',
        hint: '需求价值评估框架', d: '专业度',
        f: ['能举一个你用这个框架砍掉需求的例子吗？', '有没有出现过判断失误的情况？'] },
      { t: '用户反馈和数据显示的方向不一样，你信哪个？',
        hint: '定性定量交叉验证', d: '逻辑',
        f: ['你会怎么验证到底是哪个信号错了？', '最后你做了什么？两边都照顾到了吗？'] },
      { t: '你怎么给一个新功能定成功指标？',
        hint: '指标设计与验证设计', d: '专业度',
        f: ['你会设几个指标？主指标是哪个？', '如果上线一周数据没变，怎么判断是功能没用还是指标错了？'] }
    ],
    culture: [
      { t: '讲一个你被用户当面骂过、但最后证明你没错的经历。',
        hint: '抗挫与情绪稳定', d: '应变',
        f: ['当时你怎么回应的？', '后来这件事对你处理用户投诉的方式有改变吗？'] },
      { t: '讲一次你和设计或开发吵起来，最后怎么收场的。',
        hint: '冲突下的协作', d: '表达',
        f: ['你们分歧的点具体是什么？', '最后采纳了谁？你怎么被说服的？'] }
    ],
    stress: [
      { t: '老板直接拍了一个你认为一定会失败的需求，但你没有决策权。你怎么办？',
        hint: '在约束下推进事情', d: '应变',
        f: ['你反对过一次吗？用什么方式反对的？', '如果他已经拍板了，你还会做什么来降低风险？'] },
    ],
  },

  sales: {
    behavior: [
      { t: '你签过最大的一单是怎么谈下来的？',
        hint: '谈判过程与个人贡献', d: '表达',
        f: ['这个单子你参与了哪几个关键节点？', '如果重来一次，哪个环节你会改？'] },
      { t: '讲一次你丢掉的客户。现在回头看，问题出在哪？',
        hint: '失败复盘的真实度', d: '逻辑',
        f: ['丢单的直接原因是什么？', '其中有多少是你能控制的？'] },
      { t: '讲一次你从陌生客户做到成交的完整过程。',
        hint: '开拓过程与关键动作', d: '表达',
        f: ['你第一次联系他说了什么？', '中间哪一步差点黄了？你怎么拉的回来？'] }
    ],
    scenario: [
      { t: '客户要求降价 30%，你不让这单就会走。你怎么办？',
        hint: '价格底线与价值沟通', d: '应变',
        f: ['你会先确认他真实在意的到底是什么？', '如果他真的走了，你怎么复盘这单？'] },
      { t: '你手上的客户明显不感兴趣，怎么让他愿意继续聊？',
        hint: '需求挖掘能力', d: '专业度',
        f: ['你第一个问题会问什么？', '如果他说「就是了解一下」，你怎么接？'] },
      { t: '你负责的区域业绩连续两个季度垫底，你怎么破局？',
        hint: '业绩诊断与行动拆解', d: '逻辑',
        f: ['你先做什么？先看数据还是先见客户？', '三个月后还是没起来，你怎么复盘？'] }
    ],
    pro: [
      { t: '你怎么判断一个线索值不值得投入时间？',
        hint: '线索分级标准', d: '专业度',
        f: ['你判断错过吗？错的那次代价多大？', '你用什么信号来判断优先级？'] },
      { t: '大客户决策链上有好几个角色，你怎么找出真正拍板的人？',
        hint: '决策链识别', d: '专业度',
        f: ['你已经和谁聊过了？他们各自关心什么？', '如果找不到拍板人，你怎么处理？'] },
      { t: '你怎么判断自己是输在客户数量还是客单价？',
        hint: '业绩归因', d: '专业度',
        f: ['你用什么数据判断？', '两种情况你的打法有什么不同？'] }
    ],
    culture: [
      { t: '你为了成一单，做过最有争议的一件事是什么？',
        hint: '底线与结果导向的平衡', d: '逻辑',
        f: ['现在回头看，这个决定你还会这么做吗？', '这件事对你和客户的关系有影响吗？'] },
      { t: '说一次你为了守住承诺，让公司短期吃了亏的经历。',
        hint: '长期信任与短期业绩的平衡', d: '逻辑',
        f: ['公司那边是谁不高兴？怎么解决的？', '这个承诺你后来还守住了吗？'] }
    ],
    stress: [
      { t: '这个季度你大概率完不成目标了，你怎么跟你主管说？',
        hint: '压力下的向上沟通', d: '应变',
        f: ['你会带着方案去还是只带着问题去？', '他如果问「那你这季度做了什么」，你怎么答？'] },
    ],
  },

  marketing: {
    behavior: [
      { t: '讲一次效果不达预期的营销活动，你是怎么复盘的？',
        hint: '复盘的诚实度与方法', d: '逻辑',
        f: ['差了多少？差在哪个环节？', '复盘结论后来落地了吗？改了哪里？'] },
      { t: '你做过最成功的一次传播，为什么成功？',
        hint: '归因能力', d: '专业度',
        f: ['你怎么确定是传播带来的，而不是自然量？', '如果重做一次，你会改什么？'] },
      { t: '讲一次你和 KOL 或媒体合作翻车或成功的经历。',
        hint: '外部合作的过程管理', d: '表达',
        f: ['合作条款你是怎么谈的？', '翻车那次，责任在你还是对方？'] }
    ],
    scenario: [
      { t: '给你一笔有限预算做一次产品发布，你怎么规划这笔钱？',
        hint: '预算分配逻辑', d: '逻辑',
        f: ['你会怎么切分？哪一块一定不能省？', '如果花到一半发现效果不好，你的中止条件是什么？'] },
      { t: '竞品发布了一个明显更好的方案，你怎么应对？',
        hint: '竞争策略', d: '应变',
        f: ['你的第一反应是什么？会先做什么？', '如果我们的用户已经流失，你怎么止损？'] },
      { t: '一条内容突然爆了，但后端和产品扛不住这股流量。你怎么处理？',
        hint: '危机响应与取舍', d: '应变',
        f: ['你的前 10 分钟做什么？', '你怎么跟技术和老板要资源？'] }
    ],
    pro: [
      { t: '你怎么判断一个投放渠道值不值得继续投？',
        hint: 'ROI 归因与判断标准', d: '专业度',
        f: ['你说的 ROI 是怎么算的？', '什么情况下你会砍掉一个渠道？'] },
      { t: '活动上线后，怎么判断它是真的有效，还是只是曝光好看？',
        hint: '区分虚荣指标与真实效果', d: '逻辑',
        f: ['你会看哪几个指标之间的关系？', '如果数据不支持你的预期，你怎么说服老板？'] },
      { t: '你怎么设计一条投放内容，才能测出真实效果？',
        hint: '可归因的投放设计', d: '专业度',
        f: ['你会设什么对照组？', '什么数据会让你判定这次投放失败？'] }
    ],
    culture: [
      { t: '说一个你为了一个创意，说服别人放弃更稳妥方案的经历。',
        hint: '主动性与说服方式', d: '表达',
        f: ['你怎么说服他的？用了什么证据？', '如果没说服成，你怎么处理？'] },
      { t: '讲一次你否决了一个老板想要的创意。',
        hint: '专业判断与向上沟通', d: '表达',
        f: ['你怎么说服他的？', '如果他还是坚持，你怎么办？'] }
    ],
    stress: [
      { t: '活动当天预算突然超支，物料已经在路上了。你怎么处理？',
        hint: '应急决策', d: '应变',
        f: ['你先砍哪一部分？', '你需要打通哪些电话？顺序是什么？'] },
    ],
  },

  management: {
    behavior: [
      { t: '你管理过的最大团队是多少人？日常怎么带？',
        hint: '管理幅度与机制建设', d: '专业度',
        f: ['你建了什么机制让团队不用事事问你？', '最难管的一类人是什么类型？'] },
      { t: '讲一次你不得不处理一个低绩效员工的经历。',
        hint: '绩效管理的边界感', d: '应变',
        f: ['你给过几次机会？分别是什么？', '你怎么跟本人谈这次谈话？'] },
      { t: '讲一次你从零搭起一个机制的过程。',
        hint: '机制设计与推动力', d: '专业度',
        f: ['这个机制现在还在用吗？', '推行时最大的阻力是谁？怎么解决的？'] }
    ],
    scenario: [
      { t: '你新接手一个绩效很差的团队，前 30 天你做什么？',
        hint: '接手团队的动作顺序', d: '逻辑',
        f: ['前三天你先看什么？', '你会不会马上动人事？为什么？'] },
      { t: '团队里的核心成员提出离职，你怎么谈这次谈话？',
        hint: '保留人才的沟通', d: '表达',
        f: ['你第一句会说什么？', '如果他坚持要走，你怎么交接？'] },
      { t: '季度目标明显完不成，你怎么提前处理，而不是等到最后一刻？',
        hint: '风险前置管理', d: '逻辑',
        f: ['你会在什么时候开始动作？', '你要不要改目标？改的话怎么谈？'] }
    ],
    pro: [
      { t: '你怎么给团队定目标？定不下来怎么办？',
        hint: '目标拆解与共识建立', d: '专业度',
        f: ['目标拆到哪一层？拆到多细？', '有人反对目标时你怎么处理？'] },
      { t: '你怎么判断一个人是能力问题还是意愿问题？',
        hint: '绩效归因', d: '专业度',
        f: ['你会怎么验证这个判断？', '判断错了会怎么样？你怎么防？'] },
      { t: '你怎么让跨部门配合你的排期？',
        hint: '影响力与资源协调', d: '专业度',
        f: ['你手里有什么筹码？', '对方一直不配合，你怎么升级？'] }
    ],
    culture: [
      { t: '讲一次你的判断错了、并造成实际损失的经历。',
        hint: '自我反思与担当', d: '表达',
        f: ['你事后做了什么补救？', '这个错误改变了你什么习惯？'] },
      { t: '说一次你向上汇报坏消息的经历。你怎么说，对方什么反应？',
        hint: '向上沟通与担当', d: '表达',
        f: ['你怎么开口的？', '汇报完之后他做了什么决定？'] }
    ],
    stress: [
      { t: '你的两个下属互相甩锅，都说不是自己的问题。你怎么处理？',
        hint: '冲突处理与事实还原', d: '应变',
        f: ['你会先做什么？先问谁？', '如果事实确实是两个人都有责任呢？'] },
    ],
  },

  campus: {
    behavior: [
      { t: '实习或校园经历里最有成就感的一件事是什么？',
        hint: 'STAR，尤其是「行动」部分', d: '表达',
        f: ['这件事里你具体负责什么？', '如果不是你，结果会有什么不同？'] },
      { t: '讲一次你在小组里做得不多但很关键的事。',
        hint: '识别个人贡献', d: '逻辑',
        f: ['那个关键的部分具体是什么？', '别人为什么没做这一块？'] },
      { t: '讲一次你为了一个目标坚持下来的经历，结果可以不完美。',
        hint: '坚持与复盘', d: '表达',
        f: ['最难的是什么时候？', '最后结果怎么样？你觉得问题出在哪？'] }
    ],
    scenario: [
      { t: '入职后发现实际工作和你预期差很多，你会怎么办？',
        hint: '预期管理与职业心态', d: '应变',
        f: ['你会先做什么动作？', '什么情况下你会考虑离开？'] },
      { t: '同时要准备考试和实习，时间不够，你怎么排？',
        hint: '优先级与取舍', d: '逻辑',
        f: ['你会怎么排优先级？依据是什么？', '如果两边都压着你，你怎么谈？'] },
      { t: '实习中你犯错被指出，你会怎么处理？',
        hint: '错误处理与学习闭环', d: '应变',
        f: ['你当时第一反应是什么？', '你做了什么来保证不再犯？'] }
    ],
    pro: [
      { t: '你现在的知识储备，离这个岗位的要求还差什么？',
        hint: '自我认知与学习缺口', d: '专业度',
        f: ['你打算怎么补？第一步做什么？', '你上次主动学一个新东西是什么时候？'] },
      { t: '如果入职第一个月只能让你学一样东西，你选什么？为什么？',
        hint: '学习优先级判断', d: '逻辑',
        f: ['为什么是它，不是别的？', '学完之后你打算怎么验证学会了？'] },
      { t: '这个岗位需要的能力里，哪一项你现在最弱，打算怎么练？',
        hint: '能力自评与学习计划', d: '专业度',
        f: ['你说的怎么练，具体到每周做什么？', '你上一次这样坚持练下来，是什么时候？'] }
    ],
    culture: [
      { t: '你为什么选这个岗位？换个工作你也能做，为什么是我们？',
        hint: '动机真实性', d: '表达',
        f: ['你了解这个岗位日常具体做什么吗？', '如果我们的工作和你想象不一样，你会怎么看？'] },
      { t: '身边同学怎么评价你？他们的评价和简历上的你一致吗？',
        hint: '自我认知与一致性', d: '表达',
        f: ['他们说你最大的优点是什么？', '有没有什么评价和简历上写的不一样？'] }
    ],
    stress: [
      { t: '你觉得自己最大的短板是什么？为什么还投这个岗位？',
        hint: '自我认知与抗压', d: '应变',
        f: ['这个短板在具体工作里会怎么表现？', '你为它做过什么？'] },
    ],
  },

  finance: {
    behavior: [
      { t: '讲一次你发现并纠正了一处账目问题的经历。',
        hint: '风险敏感度与原则性', d: '专业度',
        f: ['你怎么发现的？', '纠正的过程中有没有阻力？'] },
      { t: '你做过的最复杂的一张表是怎么搭出来的？',
        hint: '结构化与工具能力', d: '逻辑',
        f: ['这张表解决什么决策？', '搭完之后你加过什么校验？'] },
      { t: '讲一次你在时间压力下做财务处理的经历。',
        hint: '压力下的准确与合规', d: '应变',
        f: ['时间压力来自哪里？', '你是怎么保证不出错的？'] }
    ],
    scenario: [
      { t: '审计发现历史数据有误，影响了一份已经上报的报表。你怎么办？',
        hint: '合规与风险处置', d: '应变',
        f: ['你的第一时间是什么？', '要不要主动上报？先跟谁说？'] },
      { t: '老板要求你把一笔存在合规问题的账做平。你怎么做？',
        hint: '底线与沟通方式', d: '应变',
        f: ['你会当场拒绝吗？怎么说？', '如果他坚持呢？你下一步做什么？'] },
      { t: '两笔款日期卡在月末，你怎么安排才不会出错？',
        hint: '时点敏感度', d: '专业度',
        f: ['你先确认什么？', '如果确认后发现做不到合规，你怎么办？'] }
    ],
    pro: [
      { t: '怎么看一家公司的现金流状况？',
        hint: '财务基本功', d: '专业度',
        f: ['你重点看哪几个数？', '一家公司现金流为负一定是坏事吗？'] },
      { t: '预算超支了 10%，你怎么处理？',
        hint: '预算管控', d: '逻辑',
        f: ['先砍哪部分？依据是什么？', '你怎么向上说明这个缺口？'] },
      { t: '你怎么保证自己做的表，别人复核时挑不出错？',
        hint: '内控与自检习惯', d: '专业度',
        f: ['你会加哪些校验？', '上一次被人挑出错是什么时候？'] }
    ],
    culture: [
      { t: '有没有一次你因为不合规而拒绝了要求？结果怎么样？',
        hint: '原则性与后果承担', d: '逻辑',
        f: ['你拒绝之后发生了什么？', '如果被拒绝了你就照做，你会怎么想？'] },
      { t: '有没有一次你因为流程合规，耽误了别人的进度？',
        hint: '规则意识与沟通', d: '逻辑',
        f: ['你怎么跟被耽误的人解释？', '最后你坚持了流程吗？'] }
    ],
    stress: [
      { t: '月末结账发现差一笔钱，明天上午就要上报。你怎么处理？',
        hint: '高压下的处理顺序', d: '应变',
        f: ['先查还是先报？为什么？', '如果查不出来，你几点说什么？'] },
    ],
  },

  admin: {
    behavior: [
      { t: '讲一次你同时处理多件紧急任务的情况。',
        hint: '多任务管理与排序', d: '逻辑',
        f: ['你怎么排的优先级？', '有没有哪件被牺牲了？后果是什么？'] },
      { t: '你主动发现并解决过公司里的什么小问题？',
        hint: '主动性', d: '表达',
        f: ['这个问题是谁都没提的，你怎么发现的？', '解决之后省了多少？'] },
      { t: '讲一次你优化了一个流程、让公司更省事的事。',
        hint: '流程敏感度与推动力', d: '逻辑',
        f: ['你怎么发现这个流程可以改的？', '改完之后省了多少？'] }
    ],
    scenario: [
      { t: '领导临时要一份重要资料，但相关同事不配合。你怎么办？',
        hint: '跨部门协调', d: '应变',
        f: ['你会先找谁？', '如果对方还是不给，你怎么升级？'] },
      { t: '一场 200 人的大型活动，你只有三天准备。列一下你要抢的资源。',
        hint: '资源优先级', d: '逻辑',
        f: ['如果只能保证三件事，你保哪三件？', '你什么时候开始叫人？'] },
      { t: '公司临时来 50 人开会，场地和设备都没有。你怎么安排？',
        hint: '应急资源调度', d: '应变',
        f: ['你第一件事做什么？', '你同时打几个电话？打给谁？'] }
    ],
    pro: [
      { t: '一场 200 人的活动，你的检查清单上会写什么？',
        hint: '细节把控与清单化能力', d: '专业度',
        f: ['你清单上最容易漏的一项是什么？', '怎么保证清单真的被执行？'] },
      { t: '日常办公采购怎么做才不出问题？',
        hint: '流程合规意识', d: '专业度',
        f: ['你会卡哪几个节点？', '如果供应商要送礼怎么办？'] },
      { t: '你怎么保证跨部门的行政需求不被漏掉？',
        hint: '流程覆盖与风险意识', d: '专业度',
        f: ['你会建立什么机制？', '上一次漏掉了什么？后果是什么？'] }
    ],
    culture: [
      { t: '讲一次你被投诉的经历。',
        hint: '服务意识与情绪管理', d: '表达',
        f: ['投诉的内容是什么？', '你后来改了什么？'] },
      { t: '讲一次你和上级在安排上不一致，你怎么处理的。',
        hint: '向上沟通', d: '表达',
        f: ['你一开始怎么说的？', '最后按谁的来？如果按你的，你承担了什么？'] }
    ],
    stress: [
      { t: '活动开始前两小时，场地突然不能用。你怎么处理？',
        hint: '应急预案', d: '应变',
        f: ['你的备用方案是什么？', '你在活动开始前多久会确认场地？'] },
    ],
  },

  general: {
    behavior: [
      { t: '讲一件你从零做成的事。',
        hint: 'STAR 四要素', d: '逻辑',
        f: ['这件事里你具体负责哪部分？', '结果怎么样，有数据吗？'] },
      { t: '说一次你的计划没实现的情况。',
        hint: '真实复盘', d: '表达',
        f: ['没实现的原因是什么？', '你现在会怎么改？'] },
      { t: '讲一次你帮别人解决问题、但那件事本来不在你职责内的经历。',
        hint: '主动性', d: '表达',
        f: ['你为什么管这件事？', '对方后来怎么回应的？'] }
    ],
    scenario: [
      { t: '你接手一个没人交接、文档也缺失的项目。第一周做什么？',
        hint: '从混乱中建立秩序', d: '逻辑',
        f: ['你第一天的产出是什么？', '怎么让团队相信你能带好？'] },
      { t: '同时有三个紧急任务压在你身上，你怎么排？',
        hint: '优先级判断', d: '应变',
        f: ['你怎么跟三个需求方沟通？', '哪一件你会拒绝？为什么？'] },
      { t: '你发现一个流程有明显问题，但改它要经过很多人。你怎么办？',
        hint: '推动力与路径选择', d: '逻辑',
        f: ['你先找谁谈？为什么？', '如果推不动，怎么让它至少往前走一点？'] }
    ],
    pro: [
      { t: '你怎么判断自己上一份工作做得好不好？',
        hint: '结果意识与自评', d: '专业度',
        f: ['你会看哪几个指标？', '别人和你的评价一致吗？'] },
      { t: '你怎么判断一件事值不值得花时间？',
        hint: '优先级判断', d: '专业度',
        f: ['你用哪几个标准？', '有没有判断错的时候？代价多大？'] },
      { t: '你手上事情很多，怎么决定先做哪一件？',
        hint: '判断标准与取舍', d: '逻辑',
        f: ['两件事都很急的时候怎么办？', '你的排序依据能说清楚吗？'] }
    ],
    culture: [
      { t: '你怎么定义自己的职业目标？',
        hint: '动机与长期性', d: '表达',
        f: ['这个目标三年后怎么衡量？', '为了它你做过什么取舍？'] },
      { t: '你希望三年后自己是什么样的？',
        hint: '长期动机', d: '表达',
        f: ['具体是什么画面？', '为了它你现在在做什么？'] },
      { t: '你上一家公司或团队待的时间长不长？为什么？',
        hint: '职业稳定性与真实动机', d: '表达',
        f: ['离开的真实原因是什么？', '如果这里也遇到同样的事，你会怎么做？'] }
    ],
    stress: [
      { t: '你被否定了三次，第四次还会按同样的方式做吗？',
        hint: '反思与调整能力', d: '应变',
        f: ['三次否定里哪次最有道理？', '你改了哪一点？'] },
    ],
  },
};

/* ---------- 组卷：严格按技能的题量分布表 ---------- */
const PLANS = {
  8:  { behavior: 2, scenario: 2, pro: 2, culture: 1, stress: 1 },
  12: { behavior: 3, scenario: 3, pro: 3, culture: 2, stress: 1 },
};

/* ---------- 简历 → 专属题 ----------
   替换掉前两道行为题和一道专业题，题量总数不变。
   考察点是「简历上写的和实际做的是不是一回事」。
--------------------------------------------------- */
function resumeQuestions(ctx) {
  if (!ctx) return [];
  const out = [];
  if (ctx.projects && ctx.projects.length) {
    const p = ctx.projects[0];
    out.push({
      type: 'behavior',
      t: `你简历上写了「${p.title}」。讲讲你在里面具体负责什么，哪一部分是你自己定的。`,
      hint: '简历真实性核对 · 个人贡献边界', d: '逻辑', fromResume: p.title,
      f: ['这个项目里最难的问题是什么？你怎么解决的？', '最后结果如何？有没有数字？'],
    });
  }
  if (ctx.experiences && ctx.experiences.length) {
    const e = ctx.experiences[0];
    out.push({
      type: 'behavior',
      t: `简历上这段「${e.title}」，你做过的最有价值的一件事是什么？`,
      hint: '岗位匹配度验证', d: '表达', fromResume: e.title,
      f: ['当时你面对的最大约束是什么？', '这段经历里你最大的收获是什么？'],
    });
  }
  if (ctx.skills && ctx.skills.length) {
    out.push({
      type: 'pro',
      t: `简历里你写了${ctx.skills.slice(0, 3).join('、')}。挑一个你最熟的讲讲：它解决什么问题，你具体怎么用的。`,
      hint: '技能真实性验证', d: '专业度', fromResume: '技能清单',
      f: ['你在什么场景下会用它？不用它会怎样？', '它有什么局限？你踩过坑吗？'],
    });
  }
  return out;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPaper(job, count, ctx) {
  const plan = PLANS[count] || PLANS[12];
  const bank = BANK[job.family] || BANK.general;
  const rq = resumeQuestions(ctx);
  let used = 0;
  const out = [];

  for (const type of Object.keys(plan)) {
    const need = plan[type];
    const take = [];
    // 简历题占用该类型的前若干名额，总题量不因此变化
    while (used < rq.length && take.length < need && rq[used].type === type) take.push(rq[used++]);

    const pool = (bank[type] && bank[type].length) ? bank[type] : (BANK.general[type] || []);
    for (const q of shuffle(pool).slice(0, need - take.length)) {
      take.push({ type, t: q.t, hint: q.hint, f: q.f, d: q.d, family: job.family });
    }
    out.push(...take);
  }

  const order = ['behavior', 'scenario', 'pro', 'culture', 'stress'];
  out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return out;
}


/* ==================== 页面交互（原 interview.js） ==================== */

/* ============================================================
   职面通 · 模拟面试对话引擎
   ------------------------------------------------------------
   每次 AI 发言前，按下列策略决定「追问」还是「进下一题」：

     规则1  回答笼统、无细节        → 追问具体行动
     规则2  提到数据但无过程        → 追问实现方法
     规则3  回答与岗位无关          → 拉回岗位要求
     规则4  回答完整                → 进下一题
     规则5  同一题最多追问 2 次      → 强制进入下一题

   ⚠️ 这是运行在浏览器里的规则引擎（关键词 + 结构信号判定），
      不是大模型。评分同理，按可观测的文字信号折算，不能替代真人判断。
   ============================================================ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const KEY = 'zt-interview-v1';
const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 1. 信号词典 ---------- */
const PROC = ['首先','然后','接着','之后','最后','第一步','第二步','第三步','于是','所以','因此','因为','为了',
              '具体','做法','方案','步骤','流程','拆解','梳理','复盘','排查','定位','当时','后来','判断','对齐',
              '先','再','从','把','通过'];
const VAGUE = ['团队','大家','我们部门','部门','多方面','认真','积极','努力','提升','优化','加强','配合','协助',
               '不断','更加','尽力','尽量','尽可能','负责','完成','做好','各位','相关'];
const TRANSFER = ['沟通','协作','抗压','学习','复盘','责任心','细心','总结','计划','目标','协调','表达','经验','主动','学习能力'];

/* ---------- 2. 回答分析器 ---------- */
function analyze(text, job) {
  const t = (text || '').trim();
  const len = t.length;

  const numHit  = t.match(/\d+(?:\.\d+)?\s*%?/);
  const hasNum  = !!numHit || /一半|翻倍|倍/.test(t);
  const procHit = PROC.filter(w => t.includes(w));
  const vagueHit= VAGUE.filter(w => t.includes(w));
  const relHit  = job.keywords.filter(k => t.includes(k));
  const trHit   = TRANSFER.filter(w => t.includes(w));
  const self    = /我/.test(t);
  const onlyWe  = /我们|团队|部门/.test(t) && !/我(?!们)/.test(t);
  const sents   = t.split(/[。！？!?；;\n]/).filter(x => x.trim()).length;

  const s = {
    len, hasNum, num: numHit ? numHit[0] : null, raw: t,
    procN: procHit.length, procHit,
    vagueN: vagueHit.length, vagueHit,
    relN: relHit.length, relHit,
    trN: trHit.length,
    self, onlyWe, sents,
  };

  // —— 规则判定（顺序即优先级）——
  // 注意 offtopic 的门槛：只有「既没命中岗位词、也没命中通用能力词、
  // 连概括词都没有」才算跑题。像「我们团队一起优化了流程」这种虽空但方向
  // 对的，应该走规则1（追问具体行动），而不是被当成跑题。
  let code;
  if (len < 4)                                              code = 'empty';
  else if (s.relN === 0 && s.trN === 0 && s.vagueN === 0 && len < 30) code = 'offtopic';
  else if (s.hasNum && s.procN === 0)                       code = 'data';
  else if (s.onlyWe || (s.vagueN >= 2 && s.procN === 0) ||
           (len < 24 && s.procN === 0 && s.relN === 0))     code = 'vague';
  else if (s.procN >= 1 && s.self && (s.hasNum || s.relN > 0 || s.len >= 45))
                                                               code = 'complete';
  else                                                      code = 'thin';

  return { s, code };
}

const RULE_TAG = {
  empty:  '空回答',
  offtopic:'答非所问',   // 规则3
  data:   '有数据无过程',// 规则2
  vague:  '过于笼统',    // 规则1
  thin:   '信息不足',
  complete:'回答完整',   // 规则4
};

/* ---------- 3. 追问生成 ---------- */
const OFFTOPIC_PULL = [
  (job) => `这道题问的是${job.name}相关的事。你说的这些和岗位的联系不太明显，能换一个${job.name}的例子吗？`,
  (job) => `我先拉回来一下——这道题要看的是你在${job.name}方向上的实际经历。重新讲一个相关的例子。`,
  (job) => `这个回答更偏别的岗位。我们面的是${job.name}，说说这个方向上的事。`,
];
const VAGUE_STAR = {
  behavior: (job, s) => `先停一下。你刚才主要说了${s.vagueHit.slice(0,2).map(x=>`「${x}」`).join('、')}这类概括词——那件事里，哪一步是你自己做的？`,
  scenario: () => '先说动作，再说理由：如果只能做一件事，你第一步会做什么？为什么是它？',
  pro:      () => '能展开讲讲吗？你是按什么顺序做的，第一步先看哪里？',
  culture:  (job, s) => `说得有点抽象。具体举一个例子——${s.vagueHit[0] || '那件事'}是指什么？你自己负责的是哪部分？`,
  stress:   () => '还是太笼统了。给我一个具体动作：你开口说的第一句话是什么？',
};
const THIN_PUSH = {
  behavior: () => '再多说一层：当时的情况有多具体？有哪些人参与？',
  scenario: () => '这个判断的依据是什么？你怎么确定是这个原因，不是另一个？',
  pro:      () => '再往下挖一层：这个方案你会怎么落地？',
  culture:  () => '有没有更具体的一次经历？时间和场景是什么？',
  stress:   () => '如果对方不接受，你准备的下一步是什么？',
};
const REVERSE = [
  '换个角度：如果重来一次，你会改哪一步？',
  '最后一个点：这件事里，你个人学到的是什么？有什么是能用数字说出来的？',
  '补一个反面：如果当时没这么做，你觉得会怎么样？',
];

function makeFollowUp(q, a, job, idx) {
  const s = a.s;
  if (a.code === 'offtopic') {
    return { text: OFFTOPIC_PULL[idx % OFFTOPIC_PULL.length](job), rule: 3 };
  }
  if (a.code === 'data') {
    return { text: `你提到「${s.num || '这个数字'}」，它具体是怎么做到的？中间做了哪几件事？`, rule: 2 };
  }
  if (a.code === 'empty') {
    return { text: '你还没有作答。这题要讲一段完整经历，简单一句话也可以，先开口。', rule: 1 };
  }
  if (idx >= 2) return null;   // 规则5 兜底
  if (idx === 1) {
    return { text: q.f && q.f[1] ? q.f[1] : REVERSE[1], rule: 1 };
  }
  if (a.code === 'vague') {
    const fn = VAGUE_STAR[q.type] || VAGUE_STAR.behavior;
    return { text: fn(job, s), rule: 1 };
  }
  if (a.code === 'thin') {
    const fn = THIN_PUSH[q.type] || THIN_PUSH.behavior;
    return { text: fn(job, s), rule: 1 };
  }
  return { text: q.f && q.f[0] ? q.f[0] : REVERSE[0], rule: 1 };
}

/* ---------- 4. 评分（BARS 五级锚定） ---------- */
const BARS = {
  pro: {
    name: '专业度', dim: '专业度',
    bars: {
      5: '能说出岗位核心概念与取舍逻辑，并主动指出方案的边界',
      4: '掌握岗位要求的技能，方案讲得通，能回答追问',
      3: '具备基本专业能力，方案可用但缺少自己的判断',
      2: '概念模糊，答案停留在复述层面',
      1: '与岗位专业要求有明显缺口',
    } },
  com: {
    name: '表达', dim: '表达',
    bars: {
      5: '结构清晰、重点突出，能主动收敛到结论',
      4: '能讲清一件事，条理基本完整',
      3: '能表达完整，但重点不够突出',
      2: '表达零散，需要对方反复确认',
      1: '难以让人理解在说什么',
    } },
  logic: {
    name: '逻辑', dim: '逻辑',
    bars: {
      5: '有清晰的因果链，能自己指出结论的适用条件',
      4: '有先后顺序和因果，能讲出为什么这么做',
      3: '有大致脉络，个别环节跳步',
      2: '想到哪说到哪，缺少因果关系',
      1: '没有可跟随的逻辑',
    } },
  adapt: {
    name: '应变', dim: '应变',
    bars: {
      5: '被追问后能调整思路，承认不足并给出新的方案',
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
  if (!recs.length) {
    return { total: 1, dims: { pro: 1, com: 1, logic: 1, adapt: 1 }, evidence: ['这一轮没有留下有效回答。'] };
  }

  // 专业度/表达/逻辑：对本题所有回答取均值。
  //   · 只看第一轮会低估「被追问后才说清」的人
  //   · 只看最好一次又会让「蒙一条好答案」直接满分
  //   均值两头都不偏；追问带来的提升由应变维度单独计。
  const all = (r) => r.answers.map(a => a.s);
  const avgRel  = r => avg(all(r).map(s => s.relN));
  const avgProc = r => avg(all(r).map(s => s.procN));
  const avgLen  = r => avg(all(r).map(s => s.len));
  const avgSent = r => avg(all(r).map(s => s.sents));
  const selfR   = r => all(r).filter(s => s.self).length / all(r).length;

  const proR   = recs.map(r => clamp01(avgRel(r) * 0.5 + avgProc(r) * 0.16 + (avgLen(r) >= 45 ? 0.3 : 0)));
  const logicR = recs.map(r => clamp01(avgProc(r) / 2.6));
  const comR   = recs.map(r => clamp01(
                     (avgSent(r) >= 2 ? 0.45 : 0.2) +
                     (avgLen(r) >= 25 && avgLen(r) <= 220 ? 0.4 : 0.12) +
                     (selfR(r) > 0.5 ? 0.15 : 0)));

  // 应变：追问后是否比第一轮更完整
  const adaptR = recs.map(r => {
    if (!r.followAnswers.length) return 0.42;         // 一次答完整，没被追问
    const gain = avg(r.followAnswers.map(a => (a.procN / 2.6) + (a.len >= 45 ? 0.35 : 0) + (a.relN * 0.2)));
    const base = (r.first.procN / 2.6) + (r.first.len >= 45 ? 0.35 : 0);
    return clamp01(0.5 + (gain - base) * 0.6);
  });

  const raw = { pro: avg(proR), logic: avg(logicR), com: avg(comR), adapt: avg(adaptR) };
  const dims = { pro: to5(raw.pro), com: to5(raw.com), logic: to5(raw.logic), adapt: to5(raw.adapt) };
  const total = Math.round(dims.pro * 0.3 + dims.logic * 0.3 + dims.com * 0.25 + dims.adapt * 0.15);

  // 评分依据（让分数可追溯，不做黑箱）
  const cnt = (c) => recs.filter(c).length;
  const evidence = [
    `${recs.length} 题中有 ${cnt(r => avgProc(r) > 0)} 题给出了完整处理过程`,
    `岗位关键词平均命中 ${avg(recs.map(avgRel)).toFixed(1)} 个 / 题`,
    `每次作答平均 ${Math.round(avg(recs.map(avgLen)))} 字`,
    `触发追问 ${recs.filter(r => r.followAnswers.length).length} 次，其中 ${cnt(r => r.followAnswers.some(a => a.procN > r.first.procN))} 次补充出了新细节`,
  ];
  return { total, dims, raw, evidence };
}

/* ---------- 5. 逐题点评 ---------- */
const NOTE = {
  offtopic: '回答和目标岗位的关联较弱，面试官会先把你拉回来——这本身就是扣分点。',
  data:     '给了数字但没给过程，面试官会问「怎么做到的」。有数据是好事，过程才是你的功劳。',
  vague:    '用了概括性表述，没有落到你个人的具体动作上。这是最常见的失分方式。',
  thin:     '信息量偏少，没有把事情讲完整，面试官只能靠追问替你补。',
  empty:    '这题没有作答。',
  complete: '结构完整，有情境也有动作，可以再补一个量化结果。',
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
    const n = all.length;
    return {
      relN: avg(all.map(s => s.relN)),
      procN: avg(all.map(s => s.procN)),
      hasNum: all.some(s => s.hasNum),
      len: avg(all.map(s => s.len)),
    };
  };
  const recs = state.records.filter(r => r.answers.length);

  const weakRel  = recs.filter(r => bestOf(r).relN < 0.5).length;
  const vagueN   = recs.filter(r => r.answers.some(a => a.code === 'vague' || a.code === 'data')).length;
  const noNum    = recs.filter(r => !bestOf(r).hasNum).length;
  const noProc   = recs.filter(r => bestOf(r).procN === 0).length;

  if (weak) {
    const B = BARS[weak[0]];
    out.push({ t: `优先补「${B.name}」`,
      d: `这轮拿到 ${weak[1]} 分，锚点是「${B.bars[weak[1]]}」。下一分要往「${B.bars[Math.min(5, weak[1] + 1)]}」靠。` });
  }
  if (noProc > 0) {
    out.push({ t: '先说过程，再说结果', d: `${noProc} 题里最好的那次回答也没有任何处理顺序。面试官听的就是「先做什么、再做什么、为什么」，这条不补上，其他都白搭。` });
  }
  if (weakRel > 0) {
    out.push({ t: '每题都往目标岗位靠', d: `${weakRel} 题没命中岗位关键词。答之前先问自己：这和${state.job.name}有什么关系？` });
  }
  if (noNum > 0) {
    out.push({ t: '结果要带数字', d: `${noNum} 题的回答里没有量化结果。哪怕是「3 天内」「2 个部门」「降了 8 成」，也比形容词有用。` });
  }
  if (vagueN > 0) {
    out.push({ t: '把「我们」改成「我」', d: `${vagueN} 题出现了概括性表述。每题至少说清一个只有你能说出来的细节：谁做的、哪一步、什么时候。` });
  }
  if (out.length < 2) {
    out.push({ t: '练 STAR', d: '行为题按 情境 → 任务 → 行动 → 结果 说，尤其别漏掉「行动」——那是面试官唯一能验证的部分。' });
  }
  return out.slice(0, 4);
}

/* ============================================================
   页面逻辑
   ============================================================ */
const state = {
  step: 1,
  answerMode: 'text',  // 回答方式：text 文字 / voice 语音
  job: null,
  resume: '',
  resumeCtx: null,
  paper: [],
  idx: 0,
  follow: 0,           // 当前题已追问次数（规则5 上限 2）
  records: [],
  skipped: 0,
  runId: null,        // 本轮唯一标识：用于成长记录去重
};

function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify({
    step: state.step, answerMode: state.answerMode, job: state.job, resume: state.resume, resumeCtx: state.resumeCtx, paper: state.paper,
    idx: state.idx, follow: state.follow, records: state.records, skipped: state.skipped,
    runId: state.runId,
  })); } catch (_) {}
}
function restore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d.job || !d.paper || !d.paper.length) return false;
    Object.assign(state, d);
    return true;
  } catch (_) { return false; }
}

/* ---------- Step 1 ---------- */
const roleInput = $('#iv-role');
const resumeBox = $('#iv-resume');
const resumeName = $('#iv-resume-name');
const roleHint = $('#iv-role-hint');
const parsePanel = $('#iv-parse');
const parseStat = $('#iv-parse-stat');
const parseGrid = $('#iv-parse-grid');
let resumeFile = '';
let resumeData = null;

const PRESETS = ['产品经理','前端开发工程师','数据分析师','运营专员','HR 专员','财务专员','市场营销','管培生'];

function onRoleInput() {
  const v = roleInput.value.trim();
  if (!v) { roleHint.hidden = true; return; }
  const j = parseJob(v);
  roleHint.hidden = false;
  roleHint.innerHTML =
    `<span class="zt-chip">${FAMILIES[j.family].label}</span>` +
    `<span class="zt-chip">${j.level}</span>` +
    `<span class="zt-chip zt-chip--ghost">${j.keywords.map(k => escapeHtml(k)).join(' · ')}</span>` +
    `<p class="iv-hint-note">考察重点：${j.focus}</p>`;
}

roleInput.addEventListener('input', onRoleInput);

$('#iv-presets').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-role]');
  if (!b) return;
  roleInput.value = b.dataset.role;
  onRoleInput();
});

const MAX_SIZE = 10 * 1024 * 1024;

/** 上传后真实解析简历，并在页面上回显抽到的东西 */
async function handleFile(f) {
  if (!f) return;
  if (f.size > MAX_SIZE) { showParseError(`文件 ${(f.size / 1048576).toFixed(1)}MB，超过 10MB 上限`); return; }
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!['pdf', 'docx', 'txt', 'md', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) { showParseError('只支持 PDF / Word / txt / 图片'); return; }

  resumeFile = f.name;
  resumeName.textContent = `${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
  resumeBox.classList.add('is-ready');
  $('#iv-resume-tip').hidden = true;
  parsePanel.hidden = false;
  parseStat.textContent = '正在解析…';
  parseStat.className = 'iv-parse__stat is-busy';
  parseGrid.innerHTML = '';

  try {
    const r = await Resume.parse(f, (stage) => { parseStat.textContent = stage + '…'; });
    resumeData = r;
    renderParse(r);
  } catch (err) {
    resumeData = null;
    showParseError(err && err.message ? err.message : '解析失败，请换一个文件');
  }
}

function showParseError(msg) {
  resumeData = null;
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

const esc = escapeHtml;
function renderParse(r) {
  const bits = [`${r.pages} 页`, `${r.chars} 字`, `${(r.ms / 1000).toFixed(1)}s`];
  parseStat.className = 'iv-parse__stat is-ok';
  parseStat.innerHTML = `✓ 已解析 <b>${esc(r.name || r.file)}</b> · ${bits.map(esc).join(' · ')}`;

  const rows = [];
  const add = (k, v) => { if (v) rows.push(`<dt>${k}</dt><dd>${v}</dd>`); };

  if (r.phone || r.email) add('联系方式', [r.phone, r.email].filter(Boolean).map(esc).join(' · '));
  r.education.slice(0, 2).forEach(e =>
    add('教育', esc([e.school, e.major, e.degree].filter(Boolean).join(' ')) + (e.period ? ` <i>${esc(e.period)}</i>` : '')));
  r.experiences.slice(0, 3).forEach(e =>
    add('经历', esc(e.title) + (e.period ? ` <i>${esc(e.period)}</i>` : '')));
  r.projects.slice(0, 4).forEach(p => add('项目', esc(p.title) + (p.period ? ` <i>${esc(p.period)}</i>` : '')));
  if (r.skills.length) add('技能', r.skills.map(s => `<span class="iv-parse__sk">${esc(s)}</span>`).join(''));

  parseGrid.innerHTML = rows.join('');
}

resumeBox.addEventListener('click', () => $('#iv-file').click());
resumeBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#iv-file').click(); }
});
$('#iv-file').addEventListener('change', (e) => handleFile(e.target.files[0]));
['dragover', 'dragenter'].forEach(ev => resumeBox.addEventListener(ev, e => { e.preventDefault(); resumeBox.classList.add('is-drag'); }));
['dragleave', 'drop'].forEach(ev => resumeBox.addEventListener(ev, e => { e.preventDefault(); resumeBox.classList.remove('is-drag'); }));
resumeBox.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

$('#iv-start').addEventListener('click', () => {
  const v = roleInput.value.trim();
  if (!v) {
    roleInput.focus();
    roleInput.closest('.iv-field').classList.add('is-error');
    setTimeout(() => roleInput.closest('.iv-field').classList.remove('is-error'), 1400);
    return;
  }
  // 先选回答方式，再进入面试
  $('#iv-mode').hidden = false;
});

$('#iv-mode-cancel').addEventListener('click', () => { $('#iv-mode').hidden = true; });
$('#iv-mode').addEventListener('click', (e) => { if (e.target === $('#iv-mode')) $('#iv-mode').hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#iv-mode').hidden) $('#iv-mode').hidden = true; });

$('#iv-mode-text').addEventListener('click', () => startInterview('text'));
$('#iv-mode-voice').addEventListener('click', () => startInterview('voice'));

/** 生成题卷时的加载状态 */
function setStartBusy(busy) {
  const btn = $('#iv-start');
  if (btn) { btn.disabled = busy; btn.textContent = busy ? '正在生成专属题目…' : '开始面试'; }
}

/** 选定回答方式后正式开局 */
async function startInterview(mode) {
  $('#iv-mode').hidden = true;
  state.answerMode = mode;

  const v = roleInput.value.trim();
  const count = Number($('input[name="iv-count"]:checked').value);
  state.job = parseJob(v);

  // 简历里的技能并入岗位关键词，提升「是否切题」判定的可靠性
  const rctx = Resume ? Resume.toContext(resumeData) : null;
  if (rctx && rctx.skills && rctx.skills.length) {
    state.job.keywords = Array.from(new Set([...state.job.keywords, ...rctx.skills])).slice(0, 12);
  }
  state.resume = resumeFile;
  state.resumeCtx = rctx;
  state.runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  state.idx = 0; state.follow = 0; state.records = []; state.skipped = 0;

  $('#live-role').textContent = state.job.name;
  $('#live-family').textContent = FAMILIES[state.job.family].label;
  setEngineBadge(LLM.label(), !!LLM.state.ai);

  if (mode === 'voice') {
    // 语音模式：不走结构化题卷，整场交给 Qwen 实时对话模型（理解 + 生成 + 语音回复）
    state.paper = [];
    $('#live-count').textContent = '自由语音对话';
    $('#live-bar').style.width = '0%';
    $('#live-plan').textContent = '语音对话 · 由 Qwen 实时模型驱动' + (rctx ? ' · 已按简历' : '');
    goto(2);
    save();
    return;
  }

  // 文字模式：题目由 AI 按岗位/简历生成，失败回退本地题库
  setStartBusy(true);
  try {
    const p = await LLM.paper({
      job: { name: state.job.name, family: state.job.family, focus: state.job.focus },
      resume: rctx ? { summary: resumeSummary(rctx), skills: rctx.skills } : null,
      count,
    });
    state.paper = p.questions.map(q => ({ ...q, family: state.job.family }));
  } catch (e) {
    state.paper = buildPaper(state.job, count, rctx);
  }
  setStartBusy(false);

  const plan = PLANS[count];
  $('#live-plan').textContent = Object.entries(plan)
    .map(([k, v2]) => `${TYPES[k].abbr}${v2}`).join(' · ')
    + (rctx ? ' · 已按简历 AI 出题' : ' · AI 专属出题');

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

/** 按当前回答方式切换「文字输入」或「语音录入」入口 */
function applyModeUI() {
  const isVoice = state.answerMode === 'voice';
  const composer = $('#iv-composer');
  const voice = $('#iv-voice');
  if (composer) composer.hidden = isVoice;
  if (voice) voice.hidden = !isVoice;
}

/** 聚焦到当前回答方式的输入入口 */
function focusAnswer() {
  if (state.answerMode === 'voice') {
    const btn = $('#iv-voice-btn');
    if (btn) btn.focus();
  } else {
    const input = $('#iv-input');
    if (input) input.focus();
  }
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

function aiMsg(q, isFollow) {
  const type = TYPES[q.type];
  const tag = isFollow
    ? `<span class="iv-tag iv-tag--follow">追问 ${state.follow} / 2</span>`
    : `<span class="iv-tag">${type.abbr}</span>`;
  push(
    `<div class="iv-msg__head">
       <span class="iv-avatar" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 面试官</span>${tag}
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
       <span class="iv-msg__who">AI 面试官</span>
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
  aiMsg(q, false);
  save();
}

/* --- 发送 --- */
const composer = $('#iv-composer');
const ta = $('#iv-input');

/** 本地规则路径：原来的 5 条规则判定 */
function rulePath(a, q, rec) {
  if (state.follow >= 2) {            // 规则5：本题追问已满 2 次
    nextQuestion();
    return;
  }
  if (a.code === 'complete') {        // 规则4
    nextQuestion();
  } else {                            // 规则1 / 2 / 3
    state.follow += 1;
    rec.follow = state.follow;
    // makeFollowUp 收的是 0 基轮次：0 = 第一问，1 = 第二问
    const fu = makeFollowUp(q, a, state.job, state.follow - 1);
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
       <span class="iv-msg__who">AI 面试官</span>
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
  const a = analyze(text, state.job);
  const rec = state.records[state.idx];
  rec.answers.push(a);
  if (rec.follow === undefined) rec.follow = 0;
  if (!rec.first) rec.first = a.s;
  else rec.followAnswers.push(a.s);

  // 硬上限：第 3 次作答一律放行，不问 AI 也不问规则
  if (state.follow >= 2) { nextQuestion(); save(); return; }

  if (!LLM.state.ai) { rulePath(a, q, rec); return; }

  const ghost = typing();
  LLM.next({
    job: { name: state.job.name, family: state.job.family, focus: state.job.focus },
    resume: state.resumeCtx ? {
      summary: resumeSummary(state.resumeCtx),
      skills: state.resumeCtx.skills,
    } : null,
    question: q.t,
    questionType: TYPES[q.type].label,
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
    // 后端挂了不能把用户卡在这：退回规则引擎继续
    ghost.remove();
    setEngineBadge('规则引擎（AI 调用失败，已自动回退）');
    rulePath(a, q, rec);
  });
}

function resumeSummary(ctx) {
  const parts = [];
  if (ctx.education && ctx.education[0]) {
    const e = ctx.education[0];
    parts.push(`教育：${[e.school, e.major, e.degree].filter(Boolean).join(' ')}`);
  }
  if (ctx.experiences && ctx.experiences[0]) parts.push(`最近经历：${ctx.experiences[0].title}`);
  if (ctx.projects && ctx.projects[0]) {
    parts.push(`项目「${ctx.projects[0].title}」：${String(ctx.projects[0].text || '').replace(/\s+/g, ' ').slice(0, 180)}`);
  }
  if (ctx.skills && ctx.skills.length) parts.push(`技能：${ctx.skills.slice(0, 10).join('、')}`);
  return parts.join('\n');
}

function nextQuestion() {
  const rec = state.records[state.idx];
  if (rec && (!rec.first || !rec.answers.length)) state.skipped++;
  if (state.idx >= state.paper.length - 1) { finish(); return; }
  state.idx += 1;
  setTimeout(() => {
    sysMsg(`—— 第 ${state.idx + 1} 题 · ${TYPES[cur().type].label} ——`);
    askCurrent();
    focusAnswer();
  }, 380);
}

composer.addEventListener('submit', (e) => { e.preventDefault(); send(); });
ta.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
});
ta.addEventListener('input', () => {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  $('#iv-send').disabled = !ta.value.trim();
});

$('#iv-skip').addEventListener('click', () => {
  sysMsg('已跳过本题。');
  nextQuestion();
});
$('#iv-quit').addEventListener('click', () => {
  if (state.answerMode === 'voice') {
    if (confirm('结束本次语音面试？')) { stopVoiceSession(); showVoiceReport(); }
  } else if (confirm('结束面试并生成报告？已答内容会保留。')) {
    finish();
  }
});

/* ==================== 语音回答（Qwen Audio Realtime · 整场对话） ==================== */
const VOICE = {
  key: 'sk-ws-H.YLHDEID.trCd.MEYCIQDE3-AcTFyCs4NQBFV_bpdco1VLOz8ArcIkrvYsnXt3YwIhAJeAc1MKPYJ7JD-sLito3srM7hIaTc1zSA5_VWUFXQGy',
  url: 'wss://cn-beijing.maas.qianwenaiapi.com/api-ws/v1/realtime?model=qwen-audio-3.1-realtime-flash',
  // 浏览器原生 WebSocket 无法设置 Authorization 头，key 走 query 参数（实测该端点支持 api_key=）
  keyQuery: 'api_key',
  voice: 'longanqian',
};

const voiceBtn = $('#iv-voice-btn');
const voiceBtnLabel = $('#iv-voice-btn-label');
const voiceHint = $('#iv-voice-hint');

let voiceWS = null;
let voiceStream = null;
let voiceCtx = null;
let voiceProc = null;
let voiceActive = false;
let voicePlayCtx = null;
let voiceAudioQueue = [];
let voiceTimer = null;
let voiceTranscript = [];

function voiceURL() {
  const sep = VOICE.url.includes('?') ? '&' : '?';
  return VOICE.url + sep + VOICE.keyQuery + '=' + encodeURIComponent(VOICE.key);
}

/** 面试官系统提示词：让 Qwen 扮演当前岗位的面试官 */
function voiceInstructions() {
  const job = state.job;
  return '你是「职面通」平台的 AI 面试官，正在对一名大学生做' + (job ? job.name + '岗位' : '求职') + '模拟面试。'
    + (job ? '岗位考察重点：' + (job.focus || '通用能力') + '。' : '')
    + '请像真实面试官一样：先简短开场，然后围绕岗位一次只问一个问题，根据对方的回答自然追问，引导他把经历和思考说具体。'
    + '全程用中文、口语化，不要一次抛多个问题，不要念题目编号。';
}

/** 开始整场语音面试 */
function startVoiceSession() {
  if (voiceActive) return;
  voiceActive = true;
  voiceBtnLabel.textContent = '结束对话';
  voiceHint.textContent = '请直接开口说话，AI 面试官会用语音回应你。';
  Paralinguistic.reset();
  voiceTranscript = [];
  const meta = $('#iv-voice-meta');
  if (meta) meta.hidden = false;
  voiceTimer = setInterval(updateVoiceMeta, 500);

  voiceWS = new WebSocket(voiceURL());
  voiceWS.onopen = () => {
    voiceWS.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: VOICE.voice,
        turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
        instructions: voiceInstructions(),
      },
    }));
    openMic();
  };
  voiceWS.onmessage = (e) => {
    let ev;
    try { ev = JSON.parse(e.data); } catch (_) { return; }
    if (ev.type === 'conversation.item.input_audio_transcription.completed' && ev.transcript) {
      // 你的话转成文字后显示在对话流里，并做副语言统计
      Paralinguistic.addTranscript(ev.transcript);
      voiceTranscript.push({ who: 'me', text: ev.transcript });
      push(`<p class="iv-msg__text">${escapeHtml(ev.transcript)}</p>`, 'me');
    } else if (ev.type === 'response.audio_transcript.done' && ev.transcript) {
      // AI 面试官的文字回复（同时播放它返回的语音）
      voiceTranscript.push({ who: 'ai', text: ev.transcript });
      aiSay(ev.transcript);
      flushVoiceAudio();
    } else if (ev.type === 'response.audio.delta' && ev.delta) {
      voiceAudioQueue.push(ev.delta);
    } else if (ev.type === 'error') {
      voiceHint.textContent = '语音服务出错：' + (ev.error && ev.error.message ? ev.error.message : '未知错误');
    }
  };
  voiceWS.onerror = () => {
    stopVoiceSession();
    voiceHint.textContent = '语音服务连接失败，请检查网络或 API key。';
  };
  voiceWS.onclose = () => {
    voiceWS = null;
    if (voiceActive) stopVoiceSession();   // 服务端主动断开时也要停掉麦克风
  };
}

/** AI 面试官的一句话（Qwen 生成，文字 + 语音） */
function aiSay(text) {
  push(
    `<div class="iv-msg__head">
       <span class="iv-avatar iv-avatar--follow" aria-hidden="true">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
           <rect x="4" y="7.5" width="16" height="12" rx="3.5"/><path d="M12 7.5V4.5"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor" stroke="none"/>
         </svg>
       </span>
       <span class="iv-msg__who">AI 面试官</span>
     </div>
     <p class="iv-msg__text">${escapeHtml(text)}</p>`,
    'ai');
}

function openMic() {
  const gUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!gUM) {
    stopVoiceSession();
    voiceHint.textContent = '当前浏览器不支持录音，请换用 Chrome / Edge。';
    return;
  }
  gUM.call(navigator.mediaDevices, {
    audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
  }).then((stream) => {
    if (!voiceActive) { stream.getTracks().forEach(t => t.stop()); return; }
    voiceStream = stream;
    const AC = window.AudioContext || window.webkitAudioContext;
    voiceCtx = new AC({ sampleRate: 16000 });
    // 关键：AudioContext 在异步回调里创建常处于 suspended，不 resume 就不会触发 onaudioprocess，
    // 也就不会发送任何音频，模型等不到输入自然不回应。
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
  }).catch(() => {
    stopVoiceSession();
    voiceHint.textContent = '无法访问麦克风：请允许浏览器使用麦克风权限。';
  });
}

/** Float32 → 16bit PCM */
function float32To16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** ArrayBuffer → base64 */
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** base64 → Uint8Array（接收端，播放 AI 语音用） */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 把收到的 AI 语音 PCM 合起来播放（24kHz 单声道 int16，与文档一致） */
function flushVoiceAudio() {
  if (!voiceAudioQueue.length) return;
  const chunks = voiceAudioQueue;
  voiceAudioQueue = [];
  const bytes = chunks.map(base64ToBytes);
  const total = bytes.reduce((n, b) => n + b.length, 0);
  if (!total) return;
  const all = new Uint8Array(total);
  let off = 0;
  for (const b of bytes) { all.set(b, off); off += b.length; }
  const pcm = new Int16Array(all.buffer, 0, Math.floor(total / 2));
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!voicePlayCtx) voicePlayCtx = new AC({ sampleRate: 24000 });
  const buf = voicePlayCtx.createBuffer(1, pcm.length, 24000);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
  const src = voicePlayCtx.createBufferSource();
  src.buffer = buf;
  src.connect(voicePlayCtx.destination);
  src.start();
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
    ['语速', m.rate + ' 字/分'],
    ['停顿', m.pauses + ' 次'],
    ['填充词', m.fillers + ' 个'],
    ['音量稳定', m.volumeStability + '%'],
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
  voiceBtnLabel.textContent = '开始语音面试';
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
if (switchText) switchText.addEventListener('click', () => {
  stopVoiceSession();
  // 语音模式是自由对话，切回文字需要重新开一局
  goto(1);
  $('#thread').innerHTML = '';
  save();
});

const plClose = $('#iv-pl-close');
if (plClose) plClose.addEventListener('click', () => { $('#iv-voice-report').hidden = true; });
const plAgain = $('#iv-pl-again');
if (plAgain) plAgain.addEventListener('click', () => {
  $('#iv-voice-report').hidden = true;
  goto(1);
  $('#thread').innerHTML = '';
  save();
});

/* ---------- Step 3 ---------- */
function finish() {
  if (!state.job || !state.paper.length) { goto(1); return; }
  if (LLM.state.ai && !state._aiReported) {
    state._aiReported = true;
    const tip = $('#rp-loading');
    tip.hidden = false;
    LLM.report({
      job: { name: state.job.name, family: state.job.family, familyLabel: FAMILIES[state.job.family].label },
      resume: state.resumeCtx ? { skills: state.resumeCtx.skills } : null,
      records: state.records.map((r, i) => ({
        i: i + 1, type: r.q.type, typeName: TYPES[r.q.type].abbr,
        question: r.q.t, answers: r.answers.map(x => x.s.raw),
      })),
    }).then((r) => { tip.hidden = true; renderReport(mergeAI(r)); })
      .catch((e) => {
        tip.hidden = true;
        setEngineBadge('规则引擎（AI 报告失败，已自动回退）');
        renderReport(scoreRun(state));
      });
    return;
  }
  renderReport(scoreRun(state));
}

/** 把 AI 报告并进本地评分：维度与总分用 AI 的，证据与安全兜底用本地的 */
function mergeAI(ai) {
  const local = scoreRun(state);
  const dims = { ...local.dims };
  for (const k of Object.keys(dims)) {
    const v = ai.dims && ai.dims[k];
    if (typeof v === 'number' && v >= 1 && v <= 5) dims[k] = v;
  }
  const total = Math.max(1, Math.min(5, Math.round(
    ai.total || (dims.pro * .3 + dims.logic * .3 + dims.com * .25 + dims.adapt * .15)
  )));
  return { total, dims, evidence: (ai.evidence && ai.evidence.length) ? ai.evidence : local.evidence, ai };
}


/* ---------- 成长归档：把这一轮写进本地的成长记录 ---------- */
const GROWTH_KEY = 'zt-growth-v1';
function archiveGrowth(sc) {
  if (!state.runId || !state.job) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(GROWTH_KEY)) || []; } catch (_) {}
  if (!Array.isArray(list)) list = [];
  if (list.some(x => x.id === state.runId)) return;      // 同一轮不重复记
  const codes = [];
  state.records.forEach(r => r.answers.forEach(a => { if (a.code) codes.push(a.code); }));
  list.push({
    id: state.runId,
    at: Date.now(),
    role: state.job.name,
    family: state.job.family || '',
    total: sc.total,
    dims: { pro: sc.dims.pro, com: sc.dims.com, logic: sc.dims.logic, adapt: sc.dims.adapt },
    answered: state.records.filter(r => r.answers.length).length,
    skipped: state.skipped,
    codes,
  });
  if (list.length > 200) list = list.slice(-200);
  try { localStorage.setItem(GROWTH_KEY, JSON.stringify(list)); } catch (_) {}
}

function renderReport(sc) {
  archiveGrowth(sc);
  const ai = sc.ai;
  const adv = advise(state, sc);

  $('#rp-role').textContent = state.job.name;
  $('#rp-family').textContent = FAMILIES[state.job.family].label;
  $('#rp-time').textContent = new Date().toLocaleString('zh-CN', { hour12: false });
  $('#rp-answered').textContent = `${state.records.filter(r => r.answers.length).length} / ${state.paper.length}`;
  $('#rp-skipped').textContent = state.skipped;
  const rc = $('#rp-resume');
  if (state.resumeCtx) {
    rc.hidden = false;
    rc.textContent = `${state.resume}${state.resumeCtx.skills.length ? ' · 已按简历出题' : ' · 已解析，无可用项目'}`;
  }

  $('#rp-total-num').textContent = sc.total;
  $('#rp-total-bar').style.width = (sc.total / 5 * 100) + '%';
  const L = v => v === 5 ? '卓越' : v === 4 ? '优秀' : v === 3 ? '胜任' : v === 2 ? '待提升' : '不胜任';
  $('#rp-total-label').textContent = L(sc.total);

  $('#rp-dims').innerHTML = ['pro', 'logic', 'com', 'adapt'].map(k => {
    const b = BARS[k], v = sc.dims[k];
    return `<li class="rp-dim">
      <div class="rp-dim__top">
        <span class="rp-dim__name">${b.name}</span>
        <span class="rp-dim__score">${v}<i>/5</i><em>${L(v)}</em></span>
      </div>
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
      <div class="rp-item__q">
        <span class="iv-tag">${TYPES[r.q.type].abbr}</span>${r.q.fromResume ? '<span class="rp-item__rs">来自简历</span>' : ''}${escapeHtml(r.q.t)}
        <span class="rp-item__no">第 ${i + 1} 题</span>
      </div>
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
  $('#rp-advice').innerHTML = advList.map(a =>
    `<li class="rp-advice"><p class="rp-advice__t">${escapeHtml(a.t)}</p><p class="rp-advice__d">${escapeHtml(a.d)}</p></li>`
  ).join('');

  $('#rp-loading').hidden = true;
  $('#rp-source').textContent = ai
    ? '评分与点评由大模型生成'
    : '评分由本地规则引擎折算';
  $('#rp-source').classList.toggle('is-ai', !!ai);
  goto(3);
  try { sessionStorage.removeItem(KEY); } catch (_) {}
}

$('#rp-again').addEventListener('click', () => {
  roleInput.value = ''; onRoleInput();
  resumeName.textContent = '';
  resumeBox.classList.remove('is-ready');
  resumeFile = ''; resumeData = null;
  parsePanel.hidden = true; parseGrid.innerHTML = '';
  $('#iv-resume-tip').hidden = false; $('#iv-file').value = '';
  $('#thread').innerHTML = '';
  $('#iv-input').value = '';
  $('#rp-again-wrap').hidden = false;
  try { sessionStorage.removeItem(KEY); } catch (_) {}
  goto(1);
});

/* ---------- 启动 ---------- */
(function init() {
  LLM.probe().then(() => {
    setEngineBadge(LLM.label(), !!LLM.state.ai);
    const n = $('#engine-note');
    if (n) { n.textContent = LLM.state.ai
      ? `已连接后端：${LLM.label()}。密钥只存在服务端，不会下发到浏览器。`
      : '当前跑在本地规则引擎上（后端未连接）。启动 server/index.js 并配好密钥即可切换到大模型。'; }
  });
  const dl = $('#iv-presets');
  dl.innerHTML = PRESETS.map(r => `<button type="button" class="iv-preset" data-role="${r}">${r}</button>`).join('');
  if (restore()) {
    $('#rp-again-wrap').hidden = true;
    if (state.step === 2 && state.answerMode === 'voice') {
      // 语音模式是自由对话，刷新后不恢复连接，回到语音入口让用户重新点击开始
      $('#live-role').textContent = state.job.name;
      $('#live-family').textContent = FAMILIES[state.job.family].label;
      $('#live-count').textContent = '自由语音对话';
      $('#live-bar').style.width = '0%';
      $('#live-plan').textContent = '语音对话 · 由 Qwen 实时模型驱动';
      goto(2);
    } else if (state.step === 2) {
      $('#live-role').textContent = state.job.name;
      $('#live-family').textContent = FAMILIES[state.job.family].label;
      $('#live-plan').textContent = Object.entries(PLANS[state.paper.length] || PLANS[12])
        .map(([k, v]) => `${TYPES[k].abbr}${v}`).join(' · ');
      goto(2);
      renderProgress();
      sysMsg(`（上次进度已恢复：答到第 ${state.idx + 1} 题）`);
      aiMsg(cur(), false);
    } else if (state.step === 3) {
      finish();
    }
  }
})();

})();
