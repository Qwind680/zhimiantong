/* ============================================================
   职面通 · 联机群面
   ------------------------------------------------------------
   联机是真的：同一浏览器开两个标签页 = 两个人，能实时互相看到发言。
   传输用 BroadcastChannel（同源多标签页），不依赖任何服务器。
   人数不足时由 AI 替补补齐座位。
   ============================================================ */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* 剩余时间的人话格式：90 → "1 分 30 秒"，45 → "45 秒" */
  function fmtLeft(sec) {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (!m) return `${r} 秒`;
    return r ? `${m} 分 ${r} 秒` : `${m} 分钟`;
  }

  const CH = 'zt-group';
  const TURN_SEC = 90;            // 每人发言时限（秒）= 1 分半
  const TURN_MS = TURN_SEC * 1000;
  const COLORS = ['#1E4BF2', '#0FB5CE', '#7C5CFF', '#F5A524', '#E4562C', '#14804C',
                  '#D6336C', '#0B7285', '#5F3DC4', '#C2255C'];

  /* ---------------- 题库 ---------------- */

  const LEVELS = {
    easy: {
      key: 'easy', name: '入门级', desc: '适合初次参加群面的同学',
      people: [4, 6], questions: [
        { t: '请用一分钟做一个自我介绍，并说说你为什么适合这个岗位。', kind: 'open' },
        { t: '你最近做过的最有成就感的一件事是什么？当时你负责哪部分？', kind: 'open' },
        { t: '如果团队里有人一直不发言，主持人应该怎么做？', kind: 'conflict' },
        { t: '给你 30 分钟做一个方案，你会先确定什么？', kind: 'task' },
        { t: '请每个人说一个自己还在补的能力，以及打算怎么补。', kind: 'open' },
      ],
    },
    std: {
      key: 'std', name: '标准级', desc: '标准群面难度，常见企业面试',
      people: [6, 8], questions: [
        { t: '产品要上线一个功能，但资源只够做一个。你选哪个？说说理由。', kind: 'conflict' },
        { t: '你负责的模块上线后数据下滑，有人主张立刻回滚，有人主张再观察一周。你怎么看？', kind: 'conflict' },
        { t: '现在给你们 10 分钟，设计一个让大学生愿意每天打开的校园产品，说清目标用户和核心功能。', kind: 'task' },
        { t: '你怎么判断一个需求是「真需求」而不是「拍脑袋」？举一个你验证过的例子。', kind: 'open' },
        { t: '团队里你和一个同事的方案冲突，deadline 只剩一天，你怎么处理？', kind: 'conflict' },
        { t: '如果只能保留一个指标来判断这个功能做成了，你会选哪个？为什么？', kind: 'task' },
      ],
    },
    hard: {
      key: 'hard', name: '挑战级', desc: '高压群面，知名企业真题',
      people: [8, 12], questions: [
        { t: '业务进入下滑期，老板要求三个月内翻倍。你们讨论出一个方案。', kind: 'task' },
        { t: '你被安排做一个三天内不可能完成的需求，直接拒绝还是接下来？', kind: 'conflict' },
        { t: '组里最有能力的人一直主导讨论，其他人逐渐不说话了。作为主持人你怎么处理？', kind: 'conflict' },
        { t: '假设你被问到一个你完全不会的技术问题，你怎么回答才不显得在编？', kind: 'open' },
        { t: '你们要说服一个不认同方案的 stakeholder，怎么准备这场沟通？', kind: 'task' },
        { t: '请每个人指出前面某位同学发言中的一个漏洞，并给出你的补充。', kind: 'conflict' },
      ],
    },
  };

  /* AI 替补的人设 */
  const PERSONAS = [
    { key: 'logic', label: '理性', open: '我先把这个问题的边界框一下。第一步是确认现在的约束到底是什么——是人力、时间还是数据。约束不同，答案就完全不同。',
      conflict: '我同意刚才的判断，但补一个前提：只看结论会忽略迁移成本。我建议先定一个可回退的最小方案，跑一轮再看数据，而不是一次押注。',
      task: '我建议把目标拆成三层：这次一定要做的、这次可以做的、这次明确不做的。先把第一层做扎实，剩下的用数据说话。' },
    { key: 'exec', label: '务实', open: '我的经验是先把能做的部分做出来再优化。我会先做一个能跑通的版本，用真实反馈驱动迭代，而不是在纸上纠结方案。',
      conflict: '这个方案的风险在于落地成本。我想先做一个最小验证版本，成本可控，一周内就能拿到结论，失败了也不亏。',
      task: '如果时间紧，我会先保核心链路，把非关键的体验先降级。宁可交一个能用的，也别交一个没做完的。' },
    { key: 'coor', label: '协调', open: '我想先听听大家的看法，我负责把讨论收拢成一个结论。我们时间有限，每个人先给一个方向，我们再往里钻。',
      conflict: '我注意到我们两个人的判断其实不冲突，只是看的角度不同。要不我们把各自最担心的一点说清楚，可能就能合并成一个方案。',
      task: '我建议先明确谁负责哪一块，避免重复劳动。我可以先认领一个方向，其他人补空缺，我们最后对齐一下。' },
  ];
  const AI_NAMES = ['林知', '陈屿', '周桐', '许舟', '苏叶', '何以', '江远', '宋柯', '温言', '陆川'];

  /* ---------------- 身份 ---------------- */

  const ME = {
    id: 'u' + Math.random().toString(36).slice(2, 9),
    name: '',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    ai: false,
  };

  let ch = null;
  try { ch = new BroadcastChannel(CH); } catch (e) { ch = null; }

  const state = {
    view: 'setup',
    difficulty: 'std',
    code: '',
    isHost: false,
    room: null,          // 房主维护
    nickname: '',
    seeking: false,      // 匹配队列中
  };

  /* ---------------- 工具 ---------------- */

  const now = () => Date.now();
  const rid = n => Math.random().toString(36).slice(2, n);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const getURL = () => new URLSearchParams(location.search);
  const myName = () => state.nickname || ME.name || ('同学' + ME.id.slice(-3).toUpperCase());

  function say(html) {
    const t = $('#zt-toast');
    if (!t) return;
    t.innerHTML = html;
    t.classList.add('is-on');
    clearTimeout(say._t);
    say._t = setTimeout(() => t.classList.remove('is-on'), 3400);
  }

  /* ---------------- 房间 ---------------- */

  function newCode() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  function makeRoom(cfg) {
    const lv = LEVELS[cfg.difficulty];
    return {
      code: cfg.code,
      difficulty: cfg.difficulty,
      target: cfg.target,
      qIndex: 0,
      phase: 'lobby',        // lobby | asking | speaking | comment | done
      speakerId: null,
      turnEndsAt: 0,
      spoke: [],              // 本轮已发言的 id
      skipped: [],            // 本轮到点但没发言（超时被跳过）的 id
      participants: [],
      transcript: [],
      questions: lv.questions,
      startedAt: 0,
    };
  }

  function pushMsg(kind, id, name, text, extra) {
    const m = { kind, id, name, text, at: now() };
    if (extra) Object.assign(m, extra);
    state.room.transcript.push(m);
    return m;
  }

  function addParticipant(p) {
    if (state.room.participants.some(x => x.id === p.id)) return;
    state.room.participants.push(Object.assign({ answers: [], joinedAt: now() }, p));
  }

  function humanPart() { return state.room.participants.filter(p => !p.ai); }
  function aiPart() { return state.room.participants.filter(p => p.ai); }

  /** 补齐 AI 替补到目标人数 */
  function fillAI() {
    const lv = LEVELS[state.room.difficulty];
    const target = state.room.target;
    let i = 0;
    while (state.room.participants.length < target && i < 40) {
      const used = new Set(state.room.participants.map(p => p.name));
      const nm = AI_NAMES.find(n => !used.has(n)) || ('同学' + i);
      const persona = PERSONAS[i % PERSONAS.length];
      addParticipant({
        id: 'ai' + rid(5), name: nm, color: COLORS[(i + 3) % COLORS.length],
        ai: true, persona: persona.key,
      });
      i++;
    }
    return lv;
  }

  function broadcast() {
    if (!state.room) return;
    if (ch) {
      ch.postMessage({
        t: 'state', room: state.room, hostId: state.isHost ? ME.id : null,
        cfg: { code: state.room.code, difficulty: state.room.difficulty, target: state.room.target },
      });
    }
    // 房主也要重绘自己的视图：BroadcastChannel 不会把消息发回自己
    if (state.isHost) renderRoom();
  }

  /* ---------------- 主持流程 ---------------- */

  function hostStart() {
    if (!state.isHost || !state.room) return;
    fillAI();
    state.room.phase = 'lobby';
    pushMsg('sys', null, null, `房间已就绪，${state.room.participants.length} 人就位。AI 面试官将按顺序点名发言。`);
    broadcast();
    setTimeout(hostAsk, 900);
  }

  function hostAsk() {
    const r = state.room;
    if (!r || r.phase === 'done') return;
    const q = r.questions[r.qIndex % r.questions.length];
    r.phase = 'asking';
    r.spoke = [];
    r.skipped = [];
    pushMsg('ai', 'ai', 'AI 面试官',
      `第 ${r.qIndex + 1} 题 · ${LEVELS[r.difficulty].name}：${q.t}`,
      { note: `每人 ${TURN_SEC} 秒，按顺序发言，说完请讲下一个。` });
    broadcast();
    setTimeout(hostNextSpeaker, 1400);
  }

  function hostNextSpeaker() {
    const r = state.room;
    if (!r || r.phase === 'done') return;
    // 顺序：真人优先（按加入顺序），再 AI 替补轮换
    const humans = humanPart();
    const ais = aiPart();
    const order = humans.concat(ais);
    // 下一个：该轮到且本轮既没发言过、也没被跳过的人
    const next = order.find(p => !r.spoke.includes(p.id) && !r.skipped.includes(p.id));
    if (!next) { hostComment(); return; }

    r.phase = 'speaking';
    r.speakerId = next.id;
    r.turnEndsAt = now() + TURN_MS;
    pushMsg('ai', 'ai', 'AI 面试官', next.ai
      ? `请 ${next.name}（AI 替补）先说，其他人先想想你的补充。`
      : `@${next.name} 请发言。`);
    broadcast();
    if (next.ai) aiAnswer(next);
    tick();
  }

  function hostComment() {
    const r = state.room;
    if (!r || r.phase === 'done') return;
    r.phase = 'comment';
    const humans = humanPart();
    const who = humans.length ? pick(humans) : null;
    const text = who
      ? `这一轮我听到几个方向。${who.name} 提到的那点比较关键，其他人可以在这基础上补充。时间还剩最后一题，我们收一下。`
      : `这一轮讨论得比较充分。最后一题，请各位把结论收敛成一个。`;
    pushMsg('ai', 'ai', 'AI 面试官', text);
    broadcast();
    setTimeout(() => {
      r.qIndex++;
      if (r.qIndex >= r.questions.length) { hostFinish(); return; }
      hostAsk();
    }, 2000);
  }

  function hostFinish() {
    const r = state.room;
    if (!r) return;
    r.phase = 'done';
    pushMsg('ai', 'ai', 'AI 面试官', '群面结束，感谢各位。评估报告已经生成。');
    broadcast();
    const rep = buildReport(r);
    r.report = rep;
    if (ch) ch.postMessage({ t: 'report', code: r.code, rep });
    renderReport(rep);
  }

  function hostTimeout() {
    const r = state.room;
    if (!r || r.phase !== 'speaking') return;
    const sp = r.participants.find(p => p.id === r.speakerId);
    if (!sp) return;
    // 关键：把这个人标记成本轮已处理，否则 hostNextSpeaker 会再次挑中他（死循环）
    if (!r.skipped.includes(sp.id)) r.skipped.push(sp.id);
    if (!sp.ai) {
      pushMsg('sys', null, null, `${sp.name} 未在时限内发言，记为未发言。`);
      broadcast();
    }
    setTimeout(hostNextSpeaker, 700);
  }

  let tickTimer = 0;
  /* 每秒刷新一次。倒计时所有人都要看得到，所以每个客户端都跑；
     但「超时 → 跳过」这个状态变更只有房主能做（房主权威制），其他人只负责重绘。 */
  function tick() {
    clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const r = state.room;
      if (!r) return;
      if (state.isHost && r.phase === 'speaking' && r.turnEndsAt && now() > r.turnEndsAt) {
        clearInterval(tickTimer);
        hostTimeout();
      }
      renderLive();
    }, 1000);
  }

  function hostAnswer(text) {
    const r = state.room;
    if (!r || r.phase !== 'speaking' || r.speakerId !== ME.id) return;
    const me = r.participants.find(p => p.id === ME.id);
    if (!me) return;
    me.answers.push(text);
    pushMsg('user', ME.id, myName(), text);
    r.spoke.push(ME.id);
    broadcast();
    setTimeout(hostNextSpeaker, 900);
  }

  /* AI 替补自动作答 */
  function aiAnswer(p) {
    const r = state.room;
    const q = r.questions[r.qIndex % r.questions.length];
    const persona = PERSONAS.find(x => x.key === (p.persona || 'logic')) || PERSONAS[0];
    let text = persona[q.kind] || persona.open;
    // 偶尔呼应别人，制造协作信号
    if (Math.random() < 0.55) {
      const others = r.participants.filter(x => x.id !== p.id && x.answers && x.answers.length);
      if (others.length) {
        const o = pick(others);
        text = `我同意${o.name}刚才的一点。` + text;
      }
    }
    setTimeout(() => {
      if (!state.room || state.room.phase !== 'speaking' || state.room.speakerId !== p.id) return;
      p.answers.push(text);
      pushMsg('user', p.id, p.name, text, { ai: true });
      state.room.spoke.push(p.id);
      broadcast();
      setTimeout(hostNextSpeaker, 900);
    }, 1200 + Math.random() * 1800);
  }

  /* ---------------- 消息 ---------------- */

  function onMessage(e) {
    const d = e.data || {};
    if (d.t === 'hello') {
      // 新人进来
      if (state.isHost && state.room && state.room.code === d.code) {
        addParticipant({ id: d.me.id, name: d.me.name, color: d.me.color, ai: false });
        pushMsg('sys', null, null, `${d.me.name} 加入了房间。`);
        broadcast();
      }
      return;
    }
    if (d.t === 'state') {
      if (d.room.code !== state.code) return;
      // 只有房主发的 state 才是权威
      if (!state.isHost) {
        state.room = d.room;
        renderRoom();
      }
      return;
    }
    if (d.t === 'answer') {
      // 提交给房主
      if (state.isHost && state.room && d.code === state.room.code) {
        if (state.room.phase === 'speaking' && state.room.speakerId === d.id) {
          const p = state.room.participants.find(x => x.id === d.id);
          if (p) {
            p.answers.push(d.text);
            pushMsg('user', d.id, p.name, d.text);
            state.room.spoke.push(d.id);
            broadcast();
            setTimeout(hostNextSpeaker, 900);
          }
        }
      }
      return;
    }
    if (d.t === 'report') {
      if (d.code !== state.code) return;
      if (state.room) state.room.report = d.rep;
      renderReport(d.rep);
      return;
    }
    if (d.t === 'seeking') {
      // 匹配对手：在本机找另一个正在排队的人
      const otherId = (d.me && d.me.id) || d.id;
      if (state.view === 'setup' && state.seeking && otherId && otherId !== ME.id) {
        state.seeking = false;
        const code = newCode();
        startAsHost(code, d.me, otherId);
        if (ch) ch.postMessage({ t: 'found', code, hostId: ME.id, to: otherId, difficulty: state.difficulty });
      }
      return;
    }
    if (d.t === 'found') {
      if (d.to === ME.id) {
        state.seeking = false;
        joinRoom(d.code, false);
        // 等房主的 state
        if (ch) ch.postMessage({ t: 'hello', code: d.code, me: { id: ME.id, name: myName(), color: ME.color } });
      }
      return;
    }
  }

  /* ---------------- 进入房间 ---------------- */

  function startAsHost(code, partner, partnerId) {
    state.code = code;
    state.isHost = true;
    state.room = makeRoom({ code, difficulty: state.difficulty, target: LEVELS[state.difficulty].people[1] });
    addParticipant({ id: ME.id, name: myName(), color: ME.color, ai: false });
    if (partner) addParticipant({ id: partner.id, name: partner.name, color: partner.color, ai: false });
    showRoom();
    // 稍等一下，让对方的 hello 先进来，再补 AI 座位，避免人数超编
    setTimeout(hostStart, 1100);
  }

  function joinRoom(code, silent) {
    state.code = code;
    state.isHost = false;
    state.view = 'room';
    $('#gp-setup').hidden = true;
    $('#gp-room').classList.add('is-on');
    if (ch) ch.postMessage({ t: 'hello', code, me: { id: ME.id, name: myName(), color: ME.color } });
    if (!silent) say('已发出加入请求，等房主开始。');
  }

  function showRoom() {
    state.view = 'room';
    $('#gp-setup').hidden = true;
    $('#gp-report').hidden = true;
    $('#gp-room').classList.add('is-on');
    renderRoom();
  }

  /* ---------------- 渲染：房间 ---------------- */

  function renderRoom() {
    const r = state.room;
    if (!r) return;
    tick();   // 保证每个客户端都有活的倒计时
    const codeEl = $('#gp-code-b');
    if (codeEl) codeEl.textContent = r.code;
    const peopleEl = $('#gp-people');
    if (peopleEl) peopleEl.innerHTML = `<b>${r.participants.length}</b> / ${r.target} 人`;
    const phaseEl = $('#gp-phase');
    if (phaseEl) phaseEl.innerHTML = phaseText(r);

    // 座位
    const seats = [];
    for (let i = 0; i < r.target; i++) {
      const p = r.participants[i];
      if (!p) {
        seats.push(`<div class="gp-seat gp-seat--empty">+</div>`);
      } else {
        seats.push(`<div class="gp-seat${p.ai ? ' gp-seat--ai' : ''}${p.id === r.speakerId ? ' is-speaking' : ''}"
          style="background:${p.color}44;border-color:${p.color}66" title="${esc(p.name)}${p.ai ? '（AI 替补）' : ''}">
          ${esc(p.name.slice(0, 1))}<span class="gp-seat__n">${esc(p.name)}</span></div>`);
      }
    }
    const seatsEl = $('#gp-seats');
    if (seatsEl) seatsEl.innerHTML = seats.join('');

    // 讨论区
    const talk = $('#gp-talk');
    const stick = talk.scrollHeight - talk.clientHeight;
    talk.innerHTML = r.transcript.map(m => {
      if (m.kind === 'sys') {
        return `<div class="gp-msg gp-msg--sys"><p class="gp-msg__t">${esc(m.text)}</p></div>`;
      }
      const isAI = m.kind === 'ai';
      const nm = esc(m.name);
      const badge = isAI ? '<em>AI 面试官</em>' : (m.ai ? '<em>AI 替补</em>' : '');
      const t = new Date(m.at);
      return `<div class="gp-msg${isAI ? ' gp-msg--ai' : ''}">
        <span class="gp-msg__a" style="background:${isAI ? '' : (m.color || '#1E4BF2')}">${isAI ? 'AI' : esc((m.name || '?').slice(0, 1))}</span>
        <div class="gp-msg__b">
          <p class="gp-msg__n">${nm}${badge}<time>${pad(t.getHours())}:${pad(t.getMinutes())}</time></p>
          <p class="gp-msg__t">${esc(m.text).replace(/@([^\s，。,.]{1,12})/g, '<mark>@$1</mark>')}</p>
        </div>
      </div>`;
    }).join('');
    talk.scrollTop = talk.scrollHeight;

    renderLive();
  }

  const pad = n => String(n).padStart(2, '0');

  function phaseText(r) {
    if (r.phase === 'lobby') return '等待开始';
    if (r.phase === 'asking') return `第 ${r.qIndex + 1} / ${r.questions.length} 题`;
    if (r.phase === 'speaking') {
      const sp = r.participants.find(p => p.id === r.speakerId);
      return sp ? `发言中 · ${sp.name}` : '发言中';
    }
    if (r.phase === 'comment') return '面试官小结';
    if (r.phase === 'done') return '已结束';
    return '';
  }

  function renderLive() {
    const r = state.room;
    if (!r) return;
    const me = r.participants.find(p => p.id === ME.id);
    const isMyTurn = r.phase === 'speaking' && r.speakerId === ME.id;
    const left = r.turnEndsAt ? Math.max(0, Math.ceil((r.turnEndsAt - now()) / 1000)) : 0;

    const tip = $('#gp-turn');
    if (tip) {
      if (isMyTurn) tip.innerHTML = `轮到你了，<b>${fmtLeft(left)}</b> 后自动跳过`;
      else if (r.phase === 'speaking') tip.innerHTML = `<span>${esc(phaseText(r))}</span><span>等待当前发言人…</span>`;
      else tip.innerHTML = `<span>${esc(phaseText(r))}</span>`;
    }
    const ta = $('#gp-ta');
    const send = $('#gp-send');
    if (ta) ta.disabled = !isMyTurn;
    if (send) send.disabled = !isMyTurn;
    const cd = $('#gp-count');
    if (cd) cd.textContent = isMyTurn ? fmtLeft(left) : '—';

    // 实时反馈：发言分布
    const dist = $('#gp-dist');
    if (dist) {
      const cnt = {};
      r.participants.forEach(p => cnt[p.id] = 0);
      r.transcript.forEach(m => { if (m.kind === 'user' && cnt[m.id] != null) cnt[m.id]++; });
      const max = Math.max(1, ...Object.values(cnt));
      dist.innerHTML = r.participants.map(p => `
        <div class="gp-dist__r">
          <span class="gp-dist__n">${esc(p.name)}${p.ai ? '·AI' : ''}</span>
          <span class="gp-dist__b"><i style="width:${(cnt[p.id] / max) * 100}%;background:${p.color}"></i></span>
          <span class="gp-dist__v">${cnt[p.id]}</span>
        </div>`).join('');
    }
    const mc = $('#gp-mine-c');
    if (mc && me) mc.textContent = me.answers.length + ' 次';
    const mr = $('#gp-mine-r');
    if (mr && me) {
      const chars = me.answers.join('').length;
      mr.textContent = chars + ' 字';
    }
  }

  /* ---------------- 报告 ---------------- */

  const SIG_RE = /(同意|我同意|刚才.{0,6}提到|补充|回应|赞同|你刚才|前面.{0,4}说|分工|我来|我先)/g;
  const DRIVE_RE = /(我先|我来|我们先|分一下工|定一下|收敛|建议先|时间有限|我认领)/g;

  function buildReport(r) {
    const humans = r.participants.filter(p => !p.ai);
    const me = humans.find(p => p.id === ME.id);
    const counts = r.participants.map(p => p.answers.length);
    const humanCounts = humans.map(p => p.answers.length);
    const rounds = r.questions.length;

    // 均衡度：真人之间发言次数的差距越小越好
    let balance = 100;
    if (humanCounts.length >= 2) {
      const mx = Math.max(...humanCounts), mn = Math.min(...humanCounts);
      balance = mx > 0 ? Math.round(100 - (mx - mn) / mx * 100) : 100;
    }
    // 参与度：每轮每人都该发言一次
    let engage = 100;
    if (me) {
      const expect = rounds;
      const ratio = Math.min(1, me.answers.length / expect);
      engage = Math.round(ratio * 100);
    }
    // 协作信号
    let collab = 100;
    if (me) {
      const all = me.answers.join('\n');
      const sig = (all.match(SIG_RE) || []).length;
      const drv = (all.match(DRIVE_RE) || []).length;
      collab = Math.min(100, Math.round(40 + sig * 12 + drv * 15));
    }
    const total = Math.round(balance * 0.3 + engage * 0.35 + collab * 0.35);

    const acts = [];
    if (me && me.answers.length === 0) {
      acts.push({ lv: 'warn', tag: '最要紧的问题', t: '你一场都没发言',
        w: '全场 <b>0</b> 次发言。群面里沉默会被直接记成"没有参与"。',
        a: '下一场给自己定一条硬规则：<b>被点名必须开口，哪怕先说一句"我先补一个点"</b>。' });
    } else if (me && me.answers.length < rounds * 0.6) {
      acts.push({ lv: 'warn', tag: '参与度', t: `只发言了 ${me.answers.length} 次`,
        w: `全场共 <b>${rounds}</b> 轮，你的发言次数低于轮次的三分之二。`,
        a: '不是要你抢话，是要<b>每轮都有你的痕迹</b>。哪怕是附和一个点加一个补充，也算。' });
    } else {
      acts.push({ lv: 'good', tag: '参与度', t: `发言 ${me.answers.length} 次，覆盖到位`,
        w: `全场 <b>${rounds}</b> 轮，你发言 <b>${me.answers.length}</b> 次。`,
        a: '保持这个节奏，下一步该练的是<b>质量</b>：让每一段都带一个具体例子或数字。' });
    }

    if (balance < 70 && humanCounts.length >= 2) {
      acts.push({ lv: 'warn', tag: '团队均衡', t: '场上发言很不均衡',
        w: `真人之间最高 <b>${Math.max(...humanCounts)}</b> 次、最低 <b>${Math.min(...humanCounts)}</b> 次，差异过大。`,
        a: '群面看的是<b>团队</b>不是你一个人。能主动把话头递出去，是稀缺能力。' });
    }

    if (me) {
      const all = me.answers.join('\n');
      const sig = (all.match(SIG_RE) || []).length;
      if (sig === 0) {
        acts.push({ lv: 'warn', tag: '协作信号', t: '全程没有回应过别人',
          w: '你的发言里没有出现"同意""补充""刚才 XX 提到"这类承接表达。',
          a: '最简单的改法：每次开口前先<b>接一句别人的话</b>，再给自己的想法。' });
      } else {
        acts.push({ lv: 'good', tag: '协作信号', t: `承接了 ${sig} 次别人的观点`,
          w: `你的发言里有 <b>${sig}</b> 处明确回应他人（同意／补充／引用）。`,
          a: '这是稀缺项，<b>继续刻意保持</b>。群面里最容易被记住的就是会接话的人。' });
      }
      const drv = (all.match(DRIVE_RE) || []).length;
      if (drv === 0) {
        acts.push({ lv: 'warn', tag: '推进意识', t: '没有一次把讨论往前推',
          w: '你的发言里没有出现"我先说""我们先定一下""我来…"这类推进表达。',
          a: '群面不缺想法，缺<b>有人把话收拢成行动</b>。每次开口都试着落到"谁做什么"。' });
      }
    }

    if (!acts.length) {
      acts.push({ lv: 'good', tag: '整体', t: '这一场没有明显短板',
        w: `协作总分 <b>${total}</b>，参与、均衡、协作三项都及格。`,
        a: '可以提高难度：<b>挑战级</b>的题会逼你在压力下做取舍。' });
    }
    return { total, balance, engage, collab, acts, rounds, me, counts };
  }

  function renderReport(prebuilt) {
    const r = state.room;
    if (!r) return;
    const rep = prebuilt || r.report || buildReport(r);
    const repEl = $('#gp-report');
    $('#gp-room').classList.remove('is-on');
    if (repEl) { repEl.hidden = false; repEl.classList.add('is-on'); }

    const lvl = rep.total >= 85 ? '优秀' : rep.total >= 70 ? '良好' : rep.total >= 55 ? '及格' : '待提升';
    $('#gp-score-n').textContent = rep.total;
    $('#gp-score-l').textContent = '团队协作分';
    $('#gp-score-e').textContent = lvl;
    $('#gp-score-rows').innerHTML = [
      { k: '发言均衡', v: rep.balance, c: '#1E4BF2', d: '真人之间发言次数的差距，越小越均衡' },
      { k: '参与积极', v: rep.engage, c: '#0FB5CE', d: '你实际发言次数 / 全场轮次' },
      { k: '协作信号', v: rep.collab, c: '#7C5CFF', d: '回应他人与推进讨论的次数' },
    ].map(x => `
      <div class="gp-score__r">
        <span>${x.k}</span>
        <span class="gp-score__bar"><i style="width:${x.v}%;background:${x.c}"></i></span>
        <b>${x.v}</b>
        <p>${x.d}</p>
      </div>`).join('');

    $('#gp-acts').innerHTML = rep.acts.map(a => `
      <article class="gp-act gp-act--${a.lv}">
        <div class="gp-act__t"><span class="gp-act__tag">${esc(a.tag)}</span><h3>${esc(a.t)}</h3></div>
        <p class="gp-act__w">${a.w}</p>
        <p class="gp-act__a">${a.a}</p>
      </article>`).join('');
  }

  /* ---------------- 交互 ---------------- */

  function bind() {
    // 难度
    $$('[data-level]').forEach(b => {
      b.addEventListener('click', () => {
        state.difficulty = b.dataset.level;
        $$('[data-level]').forEach(x => x.classList.toggle('is-on', x === b));
        const lv = LEVELS[state.difficulty];
        $('#gp-people-hint').textContent = `${lv.people[0]} - ${lv.people[1]} 人`;
        $('#gp-qhint').textContent = `本档共 ${lv.questions.length} 题`;
      });
    });

    // 昵称（两个入口联动）
    const nicks = [$('#gp-nick'), $('#gp-nick2')].filter(Boolean);
    nicks.forEach(el => el.addEventListener('input', e => {
      state.nickname = e.target.value.trim();
      nicks.forEach(x => { if (x !== e.target) x.value = e.target.value; });
    }));

    // 开房间
    $('#gp-create').addEventListener('click', () => {
      const lv = LEVELS[state.difficulty];
      const code = newCode();
      state.code = code;
      state.isHost = true;
      state.room = makeRoom({ code, difficulty: state.difficulty, target: lv.people[1] });
      addParticipant({ id: ME.id, name: myName(), color: ME.color, ai: false });
      $('#gp-code-input').value = code;
      showRoom();
      say('房间已创建，把房间码或邀请链接发给同伴，人齐了再点「开始群面」。');
    });

    // 复制邀请（设置页与房间顶栏各一个）
    const copyInvite = async () => {
      const url = `${location.origin}${location.pathname}?room=${state.code}`;
      try {
        await navigator.clipboard.writeText(url);
        say('邀请链接已复制，<b>发给别人或在新标签页打开</b>即可加入。');
      } catch (e) {
        say('复制失败，可手动复制地址栏的链接。');
      }
    };
    $('#gp-copy').addEventListener('click', copyInvite);
    const copy2 = $('#gp-copy2');
    if (copy2) copy2.addEventListener('click', copyInvite);

    // 加入
    $('#gp-join').addEventListener('click', () => {
      const code = $('#gp-code-input').value.trim().toUpperCase();
      if (code.length < 4) { say('房间码至少 4 位。'); return; }
      joinRoom(code);
    });

    // 匹配
    $('#gp-match').addEventListener('click', () => {
      state.seeking = true;
      $('#gp-match-t').textContent = '正在为你匹配本机其他等待中的参与者…';
      if (ch) ch.postMessage({ t: 'seeking', id: ME.id, me: { id: ME.id, name: myName(), color: ME.color } });
      setTimeout(() => {
        if (!state.seeking) return;
        state.seeking = false;
        const code = newCode();
        startAsHost(code, null, null);
        say('本机没有其他等待者，已开局，<b>空位由 AI 替补补齐</b>。');
      }, 2200);
    });

    // 房主：开始
    $('#gp-start').addEventListener('click', () => {
      if (!state.isHost) return;
      $('#gp-start').hidden = true;
      hostStart();
    });

    // 结束
    $('#gp-end').addEventListener('click', () => {
      if (!state.isHost) return;
      hostFinish();
    });

    // 发言
    const ta = $('#gp-ta');
    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(150, ta.scrollHeight) + 'px';
      $('#gp-send').disabled = ta.disabled || !ta.value.trim();
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $('#gp-send').addEventListener('click', send);

    function send() {
      const text = ta.value.trim();
      if (!text) return;
      if (state.isHost) {
        hostAnswer(text);
      } else if (ch) {
        ch.postMessage({ t: 'answer', code: state.code, id: ME.id, text });
      }
      ta.value = '';
      ta.style.height = 'auto';
      $('#gp-send').disabled = true;
    }

    // 再来一场
    $('#gp-again').addEventListener('click', () => {
      $('#gp-report').hidden = true;
      $('#gp-report').classList.remove('is-on');
      $('#gp-setup').hidden = false;
      $('#gp-created').hidden = true;
      state.view = 'setup';
      state.room = null;
      state.isHost = false;
      state.code = '';
    });

    // 从链接进来：先填昵称，再由用户点「加入房间」
    const q = getURL();
    if (q.get('room')) {
      const code = q.get('room').toUpperCase();
      $('#gp-code-input').value = code;
      $('#gp-join').classList.add('is-on');
      setTimeout(() => {
        say('房间码 <b>' + code + '</b> 已填好，填个昵称就能进。');
        const n = $('#gp-nick');
        if (n) { n.focus(); n.select(); }
      }, 500);
    }
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    if (ch) ch.onmessage = onMessage;
    // 默认昵称
    ME.name = '同学' + ME.id.slice(-3).toUpperCase();
    $('#gp-nick').value = ME.name;
    state.nickname = ME.name;
    $('#gp-people-hint').textContent = `${LEVELS[state.difficulty].people[0]} - ${LEVELS[state.difficulty].people[1]} 人`;
    $('#gp-qhint').textContent = `本档共 ${LEVELS[state.difficulty].questions.length} 题`;
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
