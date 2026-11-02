# 职面通 Jobont

面向大学生的 AI 求职面试平台。纯静态前端，AI 能力由前端内嵌 key 直连 DeepSeek，双击即用。

> ⚠️ **安全提醒**：`assets/llm.js` 里直接写了 DeepSeek API key，任何打开页面的人都能抄走。
> 这只适合比赛演示 / 一次性 key，用完请去 DeepSeek 平台轮换。正式部署请改回 `server/` 代理模式
> （见 `server/README.md`），把 key 收回服务端。

**品牌语：直面挑战，拿下 Offer。**

---

## 快速开始

### 只看前端（零配置）

```bash
# 任意静态服务器都行，例如：
npx serve .
# 或
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

此时**简历解析是真能用的**（PDF/DOCX 在浏览器本地解析，内容不上传），
**模拟面试跑在本地规则引擎上**（关键词 + 结构信号判定，不需要任何密钥）。

### 接大模型（可选）

```bash
cp server/.env.deepseek server/.env
# 编辑 server/.env，填入你的 DeepSeek API Key
node server/index.js
```

打开 <http://127.0.0.1:8787>，页面上的「引擎」徽标会变成 `AI 模式`。
详见 [`server/README.md`](server/README.md)。

> **安全提醒**：API Key 只能放服务端。写进任何前端文件都等于公开——
> 打开开发者工具就能抄走。浏览器里放不下密钥，所以必须有这一层代理。

---

## 目录结构

```
├── index.html          首页
├── interview.html      模拟面试（准备 / 面试 / 报告 三步）
├── bank.html           题库
│
├── assets/
│   ├── styles.css      设计 token 与全站组件（改配色/字号从这里开始）
│   ├── main.js         导航、未上线提示、滚动进场（三个页面共用）
│   │
│   ├── questions.js    面试题库：9 个岗位分族 × 5 类题型
│   ├── interview.js    模拟面试对话引擎 + 评分
│   ├── interview.css   模拟面试页样式
│   │
│   ├── exam.js         笔试题库：8 个职位类型 × 80 题（含答案解析）
│   ├── bank.js         题库页交互（分类 / 展开答案 / 收藏）
│   ├── bank.css        题库页样式
│   │
│   ├── resume.js       简历解析（PDF / DOCX / txt）
│   ├── llm.js          LLM 接入层，失败自动回退规则引擎
│   │
│   └── vendor/         第三方库，本地打包不依赖 CDN
│       ├── pdf.min.js + pdf.worker.min.js   pdfjs-dist 3.11（UMD，file:// 可加载）
│       └── mammoth.browser.min.js              mammoth 1.8
│
└── server/
    ├── index.js        LLM 代理（零依赖，Node 18+）
    ├── .env.example    全部环境变量说明
    ├── .env.deepseek   DeepSeek 快捷配置
    └── README.md       部署与供应商说明
```

---

## 设计系统

改样式只需要动 `assets/styles.css` 顶部的 `:root`，全站跟着变。

**配色**

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#F1F5FC` | 雾蓝纸面 |
| `--surface` | `#FFFFFF` | 卡片 |
| `--ink` | `#0A1533` | 主文字 |
| `--ink-2 / 3 / 4` | `#3D4D75` / `#7A88A6` / `#A3AFC6` | 次级 / 弱 / 极弱 |
| `--line / --line-2` | `#DCE5F5` / `#C6D4EE` | 发丝线 |
| `--blue` | `#1E4BF2` | 主体色 |
| `--cyan` | `#0FB5CE` | 仅用于「实时 / AI 正在…」语义 |
| `--blue-soft / --blue-wash` | `#E8EDFE` / `#F2F5FF` | 浅蓝底 |

**字体**

- `Space Grotesk` — 拉丁标题
- `Noto Sans SC` — 中文
- `IBM Plex Mono` — 眉标、编号、时间、标签

字体走 Google Fonts CDN，中文会回落到系统字体（PingFang SC / 微软雅黑）。
要完全离线自托管，把这几个字体文件下到 `assets/fonts/` 并改 `@font-face` 即可。

**命名**：一律 `zt-`（全站）、`iv-`（模拟面试）、`rp-`（报告）、`bk-`（题库）。
不要混用不同层级选择器给同一元素设 padding，会互相覆盖。

---

## 内容口径

- 主动动词、说人话，不承诺结果
- 产品原则：**不承诺给你 offer，只承诺你上考场之前每一题都练过**
- **不要编造数据**（服务人数、通过率、题目数量一律不写）
- 「预约线下」= 平台自营的**线下模拟面试间**，线上预约、免排队等位。
  不是校招宣讲、不是双选会。

---

## 已知限制

1. **规则引擎读不懂没写到关键词的话。** 面试追问和评分基于关键词与结构信号，
   措辞啰嗦的完美经历会被低估。接大模型可缓解，但同样有偏差。
2. **PDF 解析分两路。** 文字型 PDF 走本地 pdf.js；图片 / 扫描件 PDF 走 DeepSeek OCR（需联网），
   识别质量依赖模型，可能有误。
3. **DOMX 字体陷阱**：不少 PDF 会把「大」「项」「目」编码成康熙部首
   （`⼤` U+2F24），解析时必须 `.normalize('NFKC')`，否则区块标题整段匹配不上。
4. **服务器接口没有鉴权。** 公网部署前务必加登录与 IP 限流。

---

## 已验证

- 320–1440px 零横向溢出
- 键盘可完整操作，`prefers-reduced-motion` 已处理
- 简历解析：PDF / DOCX 均实测通过
- 模拟面试：五条追问规则 + 两档评分 + BARS 报告均实测通过
- 题库：答案懒渲染（未展开的题 DOM 里不含答案）、收藏持久化
- LLM 代理：已用 Mock 上游端到端验证，DeepSeek 请求格式实测可达

**未验证**：DeepSeek 真实调用（缺密钥）、真机 iOS / Android 浏览器。
