/* ============================================================
   职面通 · 成长中心
   ------------------------------------------------------------
   数据来自「模拟面试」每次结束后写进本地的记录（zt-growth-v1）。
   这里不造数：没有记录就显示空状态和起步建议。
   曲线是手写 SVG，不引第三方图表库。
   ============================================================ */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const KEY = 'zt-growth-v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 维度：BARS 五级锚定（与模拟面试同一套标准） */
  const DIMS = [
    { key: 'pro',   name: '专业度', color: '#1E4BF2' },
    { key: 'com',   name: '表达',   color: '#0FB5CE' },
    { key: 'logic', name: '逻辑',   color: '#7C5CFF' },
    { key: 'adapt', name: '应变',   color: '#F5A524' },
  ];
  const LEVEL = { 1: '不胜任', 2: '待提升', 3: '胜任', 4: '优秀', 5: '卓越' };
  const ANCHOR = {
    pro: {
      1: '与岗位专业要求有明显缺口', 2: '概念模糊，答案停留在复述层面',
      3: '具备基本专业能力，方案可用但缺少自己的判断',
      4: '掌握岗位要求的技能，方案讲得通，能回答追问',
      5: '能说出岗位核心概念与取舍逻辑，并主动指出方案的边界',
    },
    com: {
      1: '难以让人理解在说什么', 2: '表达零散，需要对方反复确认',
      3: '能表达完整，但重点不够突出', 4: '能讲清一件事，条理基本完整',
      5: '结构清晰、重点突出，能主动收敛到结论',
    },
    logic: {
      1: '结论与依据对不上', 2: '只有结论，缺少推导过程',
      3: '有基本因果链，边界条件未说明', 4: '推导完整，能说明适用范围',
      5: '有清晰的因果链，能自己指出结论的适用条件',
    },
    adapt: {
      1: '无法应对追问，答非所问反复', 2: '追问后基本重复原答案',
      3: '追问后能继续作答，但补充有限', 4: '追问后能补上细节或修正判断',
      5: '被追问后能调整思路，承认不足并给出新的方案',
    },
  };

  const CODE_NAME = {
    empty: '空回答', offtopic: '答非所问', data: '有数据无过程',
    vague: '过于笼统', thin: '信息不足', complete: '回答完整',
  };
  const CODE_LINK = {
    vague: { t: '把概括换成具体动作', link: 'interview.html', linkT: '去练一题行为面' },
    data:  { t: '有数据，补上过程', link: 'interview.html', linkT: '去练一题项目面' },
    offtopic: { t: '答案要扣住岗位', link: 'resume.html', linkT: '先把简历对齐岗位' },
    thin:  { t: '把信息量补足', link: 'bank.html', linkT: '先去题库找手感' },
    empty: { t: '不要跳过题目', link: 'bank.html', linkT: '先去题库看题型' },
    complete: { t: '基础已经稳了，可以加难度', link: 'interview.html', linkT: '去练压力面' },
  };

  const pct = v => Math.round(v * 20);   // 1-5 分 → 百分制

  /* ---------------- 数据 ---------------- */

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.slice().sort((a, b) => a.at - b.at) : [];
    } catch (e) { return []; }
  }

  function writeAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function rangeFilter(list, range) {
    const now = new Date();
    if (range === 'all') return list;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === 'week') start.setDate(start.getDate() - 6);          // 近 7 天
    if (range === 'month') start.setDate(1);                            // 本月
    return list.filter(r => new Date(r.at) >= start);
  }

  /* ---------------- 统计 ---------------- */

  function computeStats(list) {
    const n = list.length;
    if (!n) return { n: 0, avg: 0, best: 0, growth: null, first: null, last: null };
    const scores = list.map(r => pct(r.total));
    const avg = scores.reduce((a, b) => a + b, 0) / n;
    const best = Math.max(...scores);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const growth = n >= 2 && first > 0 ? Math.round((last - first) / first * 100) : null;
    return { n, avg: Math.round(avg), best, growth, first, last, delta: n >= 2 ? last - first : 0 };
  }

  /* ---------------- 曲线 ---------------- */

  /** 把记录按时间聚成点：全部按月，本周/本月按天 */
  function toPoints(list, range) {
    if (!list.length) return [];
    const byMonth = range === 'all' && list.length > 12;
    const map = new Map();
    list.forEach(r => {
      const d = new Date(r.at);
      const key = byMonth ? `${d.getFullYear()}-${d.getMonth()}` : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { key, day: d, scores: [], recs: [] });
      const p = map.get(key);
      p.scores.push(pct(r.total));
      p.recs.push(r);
    });
    return Array.from(map.values()).map(p => {
      const sum = p.scores.reduce((a, b) => a + b, 0);
      return {
        label: byMonth ? `${p.day.getMonth() + 1}月` : `${p.day.getMonth() + 1}/${p.day.getDate()}`,
        value: Math.round(sum / p.scores.length),
        count: p.scores.length,
        day: p.day,
        recs: p.recs,
      };
    });
  }

  function renderChart(points) {
    const wrap = $('#gw-chart-wrap');
    const tip  = $('#gw-tip');
    if (!wrap) return;
    if (points.length === 0) {
      wrap.innerHTML = '';
      wrap.appendChild(emptyChart());
      return;
    }

    const W = 920, H = 330;
    const PL = 46, PR = 26, PT = 22, PB = 38;
    const iw = W - PL - PR, ih = H - PT - PB;

    const vals = points.map(p => p.value);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    let yMin = Math.max(20, Math.floor((lo - 8) / 10) * 10);
    let yMax = 100;
    if (hi > yMax) yMax = Math.min(100, Math.ceil((hi + 6) / 10) * 10);
    if (yMax - yMin < 20) yMax = Math.min(100, yMin + 20);
    const step = (yMax - yMin) <= 40 ? 10 : 20;

    const X = i => points.length === 1 ? PL + iw / 2 : PL + (i / (points.length - 1)) * iw;
    const Y = v => PT + ih - ((v - yMin) / (yMax - yMin)) * ih;

    // 网格
    let g = '';
    for (let v = yMin; v <= yMax; v += step) {
      const y = Y(v);
      g += `<line class="gw-grid-l" x1="${PL}" y1="${y.toFixed(1)}" x2="${PL + iw}" y2="${y.toFixed(1)}" />`;
      g += `<text class="gw-axis-l" x="${PL - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${v}</text>`;
    }
    // X 轴
    points.forEach((p, i) => {
      const x = X(i);
      g += `<text class="gw-axis-l" x="${x.toFixed(1)}" y="${PT + ih + 24}" text-anchor="middle">${esc(p.label)}</text>`;
    });
    g += `<line x1="${PL}" y1="${PT + ih}" x2="${PL + iw}" y2="${PT + ih}" stroke="var(--line-2)" stroke-width="1" />`;

    // 面积 + 折线
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(' ');
    const area = points.length > 1
      ? `${line} L${X(points.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${X(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`
      : '';

    // 只有一个点时补一条水平参考线，不让图上孤零零浮一个点
    if (points.length === 1) {
      const y = Y(points[0].value).toFixed(1);
      g += `<line x1="${PL}" y1="${y}" x2="${PL + iw}" y2="${y}" stroke="var(--gw-pro)" stroke-width="1.6" stroke-dasharray="6 6" opacity=".38" />`;
    }
    let dots = '';
    points.forEach((p, i) => {
      const last = i === points.length - 1;
      dots += `<circle class="gw-dot${last ? ' gw-dot--last' : ''}" cx="${X(i).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="${last ? 5.4 : 4.4}"
        data-i="${i}" data-x="${X(i).toFixed(1)}" data-y="${Y(p.value).toFixed(1)}"
        data-label="${esc(p.label)}" data-v="${p.value}" data-c="${p.count}"></circle>`;
    });

    wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="成长曲线">
        <defs>
          <linearGradient id="gw-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1E4BF2" stop-opacity=".20" />
            <stop offset="100%" stop-color="#1E4BF2" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${g}
        ${area ? `<path class="gw-area" d="${area}" />` : ''}
        <path class="gw-line" d="${line}" />
        ${dots}
      </svg>`;

    // 悬停提示
    const svg = wrap.querySelector('svg');
    $$('.gw-dot', wrap).forEach(dot => {
      dot.addEventListener('mouseenter', () => {
        tip.innerHTML = `<b>${esc(dot.dataset.label)}</b> · <b>${dot.dataset.v}</b> 分<i>（${dot.dataset.c} 次）</i>`;
        tip.style.left = (dot.dataset.x / W * 100) + '%';
        tip.style.top = (dot.dataset.y / H * 100) + '%';
        tip.classList.add('is-on');
      });
      dot.addEventListener('mouseleave', () => tip.classList.remove('is-on'));
    });
    if (svg) svg.setAttribute('aria-label', `成长曲线，共 ${points.length} 个数据点，得分区间 ${yMin} 到 ${yMax}`);
  }

  function emptyChart() {
    const d = document.createElement('div');
    d.className = 'gw-empty';
    d.innerHTML = `
      <div class="gw-empty__i">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.5 9 11l4 4 7-7.5"/><path d="M3 21h18"/></svg>
      </div>
      <h3>还没有练习记录</h3>
      <p>做一次模拟面试，这里就会长出你的第一条曲线。每轮都会自动归档，不用手动填。</p>
      <div class="gw-empty__acts">
        <a class="zt-btn zt-btn--solid" href="interview.html">去做一次模拟面试</a>
        <button type="button" class="zt-btn zt-btn--line" id="gw-demo-btn">先看看示例数据</button>
      </div>`;
    return d;
  }

  /* ---------------- 成长建议 ---------------- */

  function buildAdvice(list) {
    const out = [];
    if (!list.length) return null;

    const n = list.length;
    const scores = list.map(r => pct(r.total));
    const avg = scores.reduce((a, b) => a + b, 0) / n;

    // 1) 样本量
    if (n < 3) {
      out.push({
        level: 'info', tag: '样本偏少',
        t: '再练两次，曲线才有参考价值',
        why: `目前只有 <b>${n}</b> 次记录，平均分 <b>${Math.round(avg)}</b>。样本太少时，波动大多来自题目难度而非能力变化。`,
        act: '连续练同一类岗位的题目，<b>把样本攒到 3 次以上</b>再回头看这条曲线。',
        link: 'interview.html', linkT: '去练一题',
      });
    }

    // 2) 最弱维度
    const dimAvg = {};
    DIMS.forEach(d => {
      dimAvg[d.key] = list.reduce((a, r) => a + (r.dims[d.key] || 0), 0) / n;
    });
    const weak = DIMS.slice().sort((a, b) => dimAvg[a.key] - dimAvg[b.key])[0];
    const wv = Math.round(dimAvg[weak.key]);
    if (wv < 4) {
      const next = ANCHOR[weak.key][Math.min(5, wv + 1)];
      out.push({
        level: 'warn', tag: '最弱维度',
        t: `优先补「${weak.name}」`,
        why: `${n} 次平均 <b>${wv}</b> 分（${LEVEL[wv] || ''}），是四项里最低的一项。锚点是「${ANCHOR[weak.key][wv]}」。`,
        act: `下一分要往「<b>${next}</b>」靠。挑一道跟这个维度直接相关的题，专门练它。`,
        link: weak.key === 'pro' || weak.key === 'adapt' ? 'interview.html' : 'interview.html',
        linkT: '去针对性练一题',
      });
    }

    // 3) 回答质量信号
    const cnt = {};
    let answers = 0;
    list.forEach(r => (r.codes || []).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; answers++; }));
    if (answers >= 4) {
      const order = ['vague', 'data', 'offtopic', 'thin', 'empty'];
      for (const c of order) {
        const k = cnt[c] || 0;
        if (k / answers < 0.25) continue;
        const meta = CODE_LINK[c];
        out.push({
          level: 'warn', tag: '回答质量',
          t: meta.t,
          why: `有 <b>${k}</b> 处回答被判定为「${CODE_NAME[c]}」，占全部回答的 <b>${Math.round(k / answers * 100)}%</b>。`,
          act: {
            vague: '回答里出现「负责」「提升」「配合」这类概括词时，<b>补一句「我当时具体做了哪一步」</b>。',
            data: '有数字却讲不出过程，面试官会追问方法。<b>把「做了什么」和「怎么做的」分开说</b>。',
            offtopic: '讲的是通用经验，不是这个岗位的经验。<b>把例子换成目标岗位真正会遇到的场景</b>。',
            thin: '回答太短，面试官只能靠追问补信息。<b>按「背景—动作—结果」补到三句</b>。',
            empty: '有 <b>空白题</b>，等于白白少一次练习机会。<b>没把握也先答</b>，写了才有东西可改。',
          }[c],
          link: meta.link, linkT: meta.linkT,
        });
        break;   // 一次只提最突出的一条，避免建议堆砌
      }
    }

    // 4) 跳过题目
    const skipped = list.reduce((a, r) => a + (r.skipped || 0), 0);
    if (skipped > 0) {
      out.push({
        level: 'warn', tag: '完成度',
        t: `有 ${skipped} 道题被跳过`,
        why: `跳过不会得分，也不会出现在曲线上——<b>空白是拉低均分最直接的原因</b>。`,
        act: '下一轮<b>允许自己答得烂，但不允许空着</b>。',
        link: 'bank.html', linkT: '先看题型',
      });
    }

    // 5) 趋势
    if (n >= 3) {
      const half = Math.floor(n / 2);
      const a1 = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const a2 = scores.slice(half).reduce((a, b) => a + b, 0) / (n - half);
      const d = Math.round(a2 - a1);
      if (d <= -5) {
        out.push({
          level: 'warn', tag: '趋势',
          t: '最近半程比前半程低了',
          why: `前半程平均 <b>${Math.round(a1)}</b>，后半程平均 <b>${Math.round(a2)}</b>，<b>退了 ${Math.abs(d)} 分</b>。`,
          act: '多半是题目难度变了，不是退步。<b>回到同一类题再练两次</b>确认一下。',
          link: 'bank.html', linkT: '挑同类型题',
        });
      } else if (d >= 8) {
        out.push({
          level: 'good', tag: '趋势',
          t: '后半程明显在往上走',
          why: `前半程平均 <b>${Math.round(a1)}</b>，后半程平均 <b>${Math.round(a2)}</b>，<b>涨了 ${d} 分</b>。`,
          act: '这套打法是有效的，<b>把它固定下来</b>：每道题都按同样的结构开口。',
          link: 'interview.html', linkT: '继续练',
        });
      }
    }

    // 6) 练习频次
    if (n >= 2) {
      const gap = Math.round((list[n - 1].at - list[n - 2].at) / 86400000);
      if (gap >= 10) {
        out.push({
          level: 'info', tag: '频次',
          t: `上一次练习隔了 ${gap} 天`,
          why: `间隔 <b>${gap}</b> 天。间隔越长，前面形成的答题肌肉记忆退得越快。`,
          act: '把练习拆成<b>每周 2 次、每次 20 分钟</b>，比偶尔练一场更有效。',
          link: 'booking.html', linkT: '去约一场线下面试间',
        });
      }
    }

    // 7) 岗位覆盖
    const roles = Array.from(new Set(list.map(r => r.role).filter(Boolean)));
    if (roles.length > 1) {
      const perRole = roles.map(r => `${r} ${list.filter(x => x.role === r).length} 次`);
      out.push({
        level: 'info', tag: '覆盖面',
        t: `练过 ${roles.length} 类岗位`,
        why: perRole.join(' · '),
        act: '分数是<b>按岗位的锚点</b>算的，跨岗位直接比较意义不大。<b>挑一个目标岗位做主线</b>，其余当调剂。',
        link: 'resume.html', linkT: '对齐目标岗位',
      });
    }

    if (!out.length) {
      out.push({
        level: 'good', tag: '状态',
        t: '目前没有明显短板',
        why: `${n} 次记录平均 <b>${Math.round(avg)}</b> 分，四项维度都没有明显塌陷。`,
        act: '可以开始<b>加难度</b>：换更难的题型，或者在同样时间里要求自己答得更紧凑。',
        link: 'interview.html', linkT: '去练压力面',
      });
    }
    return out;
  }

  let adviceToken = 0;

  function renderAdviceHTML(host, adv) {
    if (!adv || !adv.length) {
      host.innerHTML = `
        <p class="gw-empty__p" style="padding:6px 0 2px;font-size:13.5px;line-height:1.85;color:var(--ink-3)">
          做一次模拟面试，这里会给出<strong style="color:var(--ink)">针对你这一轮</strong>的具体建议——
          哪个维度最弱、哪类回答反复出问题、下一步该练什么，每条都会写清依据。
        </p>`;
      return;
    }
    host.innerHTML = adv.map(a => `
      <article class="gw-adv__item gw-adv__item--${a.level}">
        <div class="gw-adv__top">
          <span class="gw-adv__tag">${esc(a.tag)}</span>
          <h3 class="gw-adv__t">${esc(a.t)}</h3>
        </div>
        <p class="gw-adv__why">${a.why}</p>
        <p class="gw-adv__act">${a.act}</p>
        <a class="gw-adv__go" href="${esc(a.link)}">
          ${esc(a.linkT)}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>
        </a>
      </article>`).join('');
  }

  function renderAdvice(list) {
    const host = $('#gw-advice');
    if (!host) return;
    // 先渲染本地建议，AI 生成后替换（失败则保留本地）
    renderAdviceHTML(host, buildAdvice(list));
    if (window.LLM && LLM.state.ai && list && list.length) {
      const token = ++adviceToken;
      const loading = document.createElement('div');
      loading.className = 'gw-adv__loading';
      loading.textContent = 'AI 建议生成中…';
      host.prepend(loading);
      LLM.growth({ records: list }).then((ai) => {
        if (token !== adviceToken) return;   // 期间切换了范围，丢弃过期结果
        if (ai && ai.advice && ai.advice.length) {
          renderAdviceHTML(host, ai.advice.map(a => ({ ...a, link: 'interview.html', linkT: '去练一题' })));
        } else {
          loading.remove();
        }
      }).catch(() => { loading.remove(); });
    }
  }

  /* ---------------- 练习记录 ---------------- */

  function renderList(list) {
    const host = $('#gw-list');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = `<p style="font-size:13.5px;color:var(--ink-3);padding:6px 0">暂无记录。</p>`;
      return;
    }
    host.innerHTML = list.slice().reverse().map(r => {
      const d = new Date(r.at);
      const ds = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
      const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const bars = DIMS.map(dim => {
        const v = r.dims[dim.key] || 0;
        return `<i style="--w:${v / 5 * 100}%;--c:${dim.color}" title="${dim.name} ${v} 分"></i>`;
      }).join('');
      const bad = (r.codes || []).filter(c => c === 'vague' || c === 'offtopic' || c === 'empty').length;
      return `<div class="gw-row">
        <div class="gw-row__d"><b>${ds}</b>${ts}</div>
        <div class="gw-row__r">${esc(r.role || '未记录岗位')}<span>答 ${r.answered} 题${r.skipped ? ` · 跳过 ${r.skipped} 题` : ''}${bad ? ` · ${bad} 处待改` : ''}</span></div>
        <div class="gw-row__bars">${bars}</div>
        <div class="gw-row__s">${pct(r.total)}<small>/100</small></div>
      </div>`;
    }).join('');
  }

  /* ---------------- 统计卡 ---------------- */

  function renderStats(list, st) {
    const el = (id, v) => { const n = $(id); if (n) n.textContent = v; };
    el('#gw-s-n', st.n);
    el('#gw-s-avg', st.n ? st.avg : '—');
    el('#gw-s-best', st.n ? st.best : '—');
    el('#gw-s-growth', st.growth == null ? '—' : (st.growth > 0 ? '+' : '') + st.growth + '%');
    el('#gw-s-growth-x', st.n >= 2
      ? `首次 ${st.first} → 当前 ${st.last}（${st.delta >= 0 ? '+' : ''}${st.delta} 分）`
      : (st.n === 1 ? '再练一次就能看出幅度' : '完成一次面试后开始记录'));
    el('#gw-s-n-x', st.n ? `覆盖 ${Array.from(new Set(list.map(r => r.role).filter(Boolean))).length || 0} 类岗位` : '还没有记录');
    el('#gw-s-avg-x', st.n ? `满分 100` : '还没有记录');
    el('#gw-s-best-x', st.n ? `最近一次 ${st.last} 分` : '还没有记录');
  }

  /* ---------------- 范围切换 ---------------- */

  let RANGE = 'all';

  function render() {
    const all = readAll();
    const list = rangeFilter(all, RANGE);
    const st = computeStats(list);
    renderStats(list, st);
    renderChart(toPoints(list, RANGE));
    renderAdvice(list);
    renderList(list);

    const n = $('#gw-range-n');
    if (n) n.textContent = list.length;
    const demo = $('#gw-demo-note');
    if (demo) demo.hidden = all.length === 0 || !all.some(r => r.demo);
  }

  /* ---------------- 示例数据 ---------------- */

  function loadDemo() {
    const base = Date.now();
    const plan = [
      { ago: 26, total: 3, dims: { pro: 3, com: 3, logic: 2, adapt: 2 }, role: '产品经理', skipped: 2, codes: ['vague', 'vague', 'thin'] },
      { ago: 21, total: 3, dims: { pro: 3, com: 3, logic: 3, adapt: 2 }, role: '产品经理', skipped: 1, codes: ['vague', 'data'] },
      { ago: 15, total: 4, dims: { pro: 3, com: 4, logic: 3, adapt: 3 }, role: '产品经理', skipped: 0, codes: ['data', 'complete'] },
      { ago: 9,  total: 4, dims: { pro: 4, com: 4, logic: 3, adapt: 3 }, role: '产品经理', skipped: 0, codes: ['complete', 'data'] },
      { ago: 4,  total: 4, dims: { pro: 4, com: 4, logic: 4, adapt: 3 }, role: '产品经理', skipped: 0, codes: ['complete', 'complete'] },
    ];
    const list = plan.map((p, i) => ({
      id: 'demo' + i, demo: true,
      at: base - p.ago * 86400000,
      role: p.role, family: 'product',
      total: p.total, dims: p.dims,
      answered: 10 - p.skipped, skipped: p.skipped, codes: p.codes,
    }));
    writeAll(list);
    RANGE = 'all';
    $$('.gw-seg button').forEach(b => b.classList.toggle('is-on', b.dataset.range === 'all'));
    render();
    const d = $('#gw-demo-note');
    if (d) d.hidden = false;
  }

  function clearDemo() {
    const list = readAll().filter(r => !r.demo);
    writeAll(list);
    render();
  }

  /* ---------------- 绑定 ---------------- */

  function init() {
    render();

    $$('.gw-seg button').forEach(b => {
      b.addEventListener('click', () => {
        RANGE = b.dataset.range;
        $$('.gw-seg button').forEach(x => x.classList.toggle('is-on', x === b));
        render();
      });
    });

    document.addEventListener('click', (e) => {
      const demoBtn = e.target.closest('#gw-demo-btn');
      if (demoBtn) { loadDemo(); return; }
      const clr = e.target.closest('#gw-demo-clear');
      if (clr) { clearDemo(); }
    });

    // 从模拟面试那边跳回来时刷新
    window.addEventListener('focus', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
