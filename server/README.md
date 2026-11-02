# 职面通 · LLM 代理服务

浏览器里的 API key 等于公开。这个服务持有密钥，只暴露两个业务接口，
前端永远拿不到 key，也拿不到模型名。

```
浏览器 ──► /api/interview   ──► LLM
       ──► /api/report      ──► LLM
       ──► /api/resume      ──► LLM（简历优化：改写 + 建议）
       ──► /api/health      （探测是否可切到 AI 模式）
```

## 用 DeepSeek（最快的一条路）

1. 到 [platform.deepseek.com](https://platform.deepseek.com) 建个 key
2. ```bash
   cp server/.env.deepseek server/.env
   # 打开 server/.env，把 LLM_API_KEY 换成你的 key
   node server/index.js
   ```
3. 打开 http://127.0.0.1:8787/interview.html，徽标应显示 `AI 模式 · deepseek/deepseek-chat`

已经配好的：base_url、模型、`json_object` 输出模式、格式不合规时的自动重试。
你只需要填 key。

**模型怎么选**

| 模型 | 说明 | 建议 |
|---|---|---|
| `deepseek-chat` | V3，日常首选，快、便宜 | 默认用这个 |
| `deepseek-reasoner` | R1，会先想再答，规则遵守更严 | 面试逻辑复杂时更稳，但慢且贵约 5 倍 |

## 本地跑（任意供应商）

```bash
cp server/.env.example server/.env
# 编辑 server/.env，至少填 LLM_API_KEY
node server/index.js
```

打开 http://127.0.0.1:8787/interview.html
页面上「引擎」徽标会显示 `AI 模式 · <provider>/<model>`。

前端和接口不同源时（比如静态站部署在别处），在 `.env` 里设：

```
CORS_ORIGIN=https://你的站点地址
```

## 部署

任何能跑 Node 18+ 的地方都行。零依赖，不需要 `npm install`。

**Railway / Render / Fly.io / 自己的 VPS**
```
构建命令：留空
启动命令：node server/index.js
环境变量：按 .env.example 填
```

**Vercel / Netlify（Serverless）**
把 `server/index.js` 里的 `http.createServer` 逻辑改成导出一个 handler，
挂到 `/api/interview`、`/api/report`、`/api/health` 三条路由即可，
业务函数（`handleInterview` / `handleReport`）可以原样复制。

**Cloudflare Workers**
接口本身就是标准 fetch handler，迁移成本很低，注意
`AbortSignal.timeout()` 替代 `AbortController`。

## 没配密钥会怎样

`/api/health` 返回 `{"ai": false}`，前端自动停在规则引擎上，
所有功能照常可用，只是追问和评分走的是本地规则而不是大模型。
**后端跑不起来不会让网站挂掉**，这是有意设计的。

## 支持的供应商

OpenAI 兼容协议的一律填 provider 名即可：
`openai` `deepseek` `moonshot` `zhipu` `qwen` `silicon` `groq` `openrouter` `ollama`

Anthropic 走单独的分支，填 `LLM_PROVIDER=anthropic`。

自建/代理服务填 `LLM_BASE_URL` + `LLM_MODEL` 即可，provider 名只影响默认值。

## 几条硬约束（别绕过）

- **追问上限在服务端强制**：`follow >= 2` 一律放行下一题，不问模型。
  模型是不遵守指令的，这条规则只能靠代码兜。
- 密钥只从环境变量读，没有任何接口会回显它。
- 请求体上限 1MB，并发上限 `LLM_MAX_INFLIGHT`，单请求超时 `LLM_TIMEOUT_MS`。
  公网部署前建议再加一层 IP 限流和登录鉴权。

## 提示词在哪

`INTERVIEW_SYSTEM`、`REPORT_SYSTEM`、`RESUME_SYSTEM` 三个常量。
改追问风格、改评分口径、改简历改写风格，改这里就行，前端不用动。
