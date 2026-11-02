/* ============================================================
   职面通 · 预约线下
   纯前端：地点/时段/表单 → 本地生成预约 → 预约码 + 日历导出
   说明：本站无后端，预约只存在当前浏览器的 localStorage
   ============================================================ */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const STORE_KEY = 'zt.bookings.v1';

  /* ---------------- 地点与面试间 ---------------- */

  const PLACES = [
    {
      id: 'hdy',
      name: '海淀 · 学院南路',
      addr: '北京市海淀区学院南路 39 号',
      metro: '地铁 10 号线知春路站 B 口出，步行约 6 分钟',
      open: '09:00 - 21:00',
      rooms: [
        { id: 'A', name: '单人间 A' },
        { id: 'B', name: '单人间 B' },
      ],
    },
    {
      id: 'cp',
      name: '昌平 · 沙河顺沙路',
      addr: '北京市昌平区顺沙路沙河段 1 号',
      metro: '地铁昌平线沙河站 A 口出，步行约 10 分钟',
      open: '09:00 - 21:00',
      rooms: [
        { id: 'A', name: '单人间 A' },
        { id: 'B', name: '单人间 B' },
      ],
    },
  ];

  /* 场次：09:00 - 21:00 每个整点开一场，每场 40 分钟（中间留 20 分钟周转） */
  const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
                 '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  const PRICE = 29;        // 全部是单人间，一个价
  const STUDENT_OFF = 10; // 学生证再减 10（29 → 19）
  const DURATION_MIN = 40;

  const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ---------------- 小工具 ---------------- */

  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 稳定哈希：同一个 key 永远得到同一个数，用来生成"看起来真实"的余位 */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    // fmix32 收尾：FNV 末尾改一个字符，结果只差万分之几，
    // 不做这一步，同一间房的整行余位会长得一模一样。
    h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function ymd(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseYmd(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function slotEnd(start) {
    const [h, m] = start.split(':').map(Number);
    const t = h * 60 + m + DURATION_MIN;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
  }

  const money = n => `¥${n}`;

  /* ---------------- 可约状态 ---------------- */

  /**
   * 场次状态：只分两种
   *   free   —— 可约
   *   closed —— 不开放（营业时间外 / 周末限制 / 今天已经过去的时段）
   * 不再有「已约满」：这个页面不做抢位，别人约没约跟你无关。
   */
  function cellState(placeId, room, dateStr, slotIdx) {
    const slot = SLOTS[slotIdx];
    const place = PLACES.find(p => p.id === placeId);
    const day = parseYmd(dateStr);

    // 超出营业时间（"09:00 - 20:00" 必须整体解析，不能 slice(-2)）
    const om = String(place.open).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const openStart = om ? (+om[1]) * 60 + (+om[2]) : 0;
    const openEnd = om ? (+om[3]) * 60 + (+om[4]) : 24 * 60;
    const sh = parseInt(slot.slice(0, 2), 10) * 60;
    if (sh < openStart || sh + DURATION_MIN > openEnd) return 'closed';

    // 今天已经过去的时段（至少留 1 小时准备）
    const now = new Date();
    if (day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth()
        && day.getDate() === now.getDate()) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (sh < nowMin + 10) return 'closed';   // 至少留 10 分钟到场
    }

    return 'free';
  }

  /** 这场是不是我自己已经约下的 */
  function isMine(placeId, roomId, dateStr, slotIdx) {
    return bookings().some(b => b.status === 'booked' && b.placeId === placeId
      && b.roomId === roomId && b.date === dateStr && b.slot === SLOTS[slotIdx]);
  }

  /* ---------------- 预约存取 ---------------- */

  function bookings() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveBookings(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* 隐私模式，忽略 */ }
  }

  function makeCode(dateStr) {
    const d = dateStr.slice(5).replace('-', '');
    const n = new Uint32Array(1);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(n)
      : (n[0] = Math.floor(Math.random() * 4294967295));
    const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    let v = n[0];
    for (let i = 0; i < 4; i++) { s += A[v % A.length]; v = Math.floor(v / A.length); }
    return `ZT-${d}-${s}`;
  }

  /* ---------------- 状态 ---------------- */

  const state = {
    placeId: PLACES[0].id,
    date: '',
    roomId: null,
    slotIdx: null,
    days: [],
  };

  const place = () => PLACES.find(p => p.id === state.placeId);
  const room  = () => place().rooms.find(r => r.id === state.roomId) || null;
  const slot  = () => (state.slotIdx == null ? null : SLOTS[state.slotIdx]);

  /* ---------------- 提示条 ---------------- */

  const toast = $('#zt-toast');
  let toastTimer = 0;
  function say(html) {
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3200);
  }

  /* ---------------- 1. 地点 ---------------- */

  function renderPlaces() {
    const host = $('#bk-places');
    if (!host) return;
    host.innerHTML = PLACES.map(p => `
      <button type="button" class="bk-place${p.id === state.placeId ? ' is-on' : ''}"
              data-place="${p.id}" aria-pressed="${p.id === state.placeId}">
        <span class="bk-place__check" aria-hidden="true">✓</span>
        <span class="bk-place__name">${esc(p.name)}</span>
        <p class="bk-place__addr">${esc(p.addr)}</p>
        <p class="bk-place__metro">${esc(p.metro)}</p>
        <ul class="bk-place__rooms">
          ${p.rooms.map(r => `<li>${esc(r.name)}</li>`).join('')}
        </ul>
        <span class="bk-place__meta">
          <span class="bk-place__tag">营业 ${esc(p.open)}</span>
          <span class="bk-place__tag">${p.rooms.length} 间面试间</span>
        </span>
      </button>`).join('');

    $$('[data-place]', host).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.place;
        if (id === state.placeId) return;
        state.placeId = id;
        state.roomId = null;
        state.slotIdx = null;
        renderPlaces();
        renderDays();
        renderRooms();
        renderLanes();
        renderSummary();
      });
    });
  }

  /* ---------------- 2. 日期 ---------------- */

  function buildDays() {
    const out = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const ds = ymd(d);
      let free = 0;
      place().rooms.forEach(r => {
        SLOTS.forEach((_, si) => { if (cellState(state.placeId, r, ds, si) === 'free') free++; });
      });
      out.push({
        date: ds, d, free,
        label: i === 0 ? '今天' : (i === 1 ? '明天' : WEEK_CN[d.getDay()]),
        // 约不了的原因要说准：今天来不及 ≠ 不开放
        note: free > 0 ? `${free} 场` : (i === 0 ? '已过时' : '不开放'),
      });
    }
    return out;
  }

  function renderDays() {
    const host = $('#bk-days');
    if (!host) return;
    state.days = buildDays();
    // 默认选中第一个有可约场次的日期
    if (!state.days.some(x => x.date === state.date)) {
      const first = state.days.find(x => x.free > 0) || state.days[0];
      state.date = first.date;
    }
    host.innerHTML = state.days.map(x => `
      <button type="button" class="bk-day${x.date === state.date ? ' is-on' : ''}"
              data-date="${x.date}" aria-pressed="${x.date === state.date}"
              ${x.free === 0 ? 'disabled' : ''}>
        <span class="bk-day__w">${esc(x.label)}</span>
        <span class="bk-day__d">${x.d.getMonth() + 1}/${x.d.getDate()}</span>
        <span class="bk-day__n${x.free === 0 ? ' is-none' : ''}">${esc(x.note)}</span>
      </button>`).join('');

    $$('[data-date]', host).forEach(btn => {
      btn.addEventListener('click', () => {
        state.date = btn.dataset.date;
        state.slotIdx = null;      // 换日期只重置时段，面试间跟日期无关，保留
        renderDays();
        renderRooms();
        renderLanes();
        renderSummary();
      });
    });
  }

  /* ---------------- 3. 场次表 ---------------- */


  /** 选面试间：每处的两间，先选间，再看它的时段 */
  function renderRooms() {
    const host = $('#bk-rooms');
    if (!host) return;
    const p = place();
    const mine = bookings().filter(b => b.status === 'booked' && b.placeId === p.id);

    host.innerHTML = p.rooms.map(r => {
      const mineSlots = mine.filter(b => b.roomId === r.id && b.date === state.date);
      const freeCount = SLOTS.filter((_, si) =>
        cellState(p.id, r, state.date, si) === 'free' && !isMine(p.id, r.id, state.date, si)).length;
      const strip = SLOTS.map((_, si) => {
        const st = cellState(p.id, r, state.date, si);
        const cls = isMine(p.id, r.id, state.date, si) ? 'is-mine' : `is-${st}`;
        return `<i class="${cls}"></i>`;
      }).join('');
      const meta = mineSlots.length
        ? `12 个时段 · 可约 ${freeCount} 个 · 你已约 ${mineSlots.length} 个`
        : `12 个时段 · 可约 ${freeCount} 个`;
      return `<button type="button" class="bk-roomcard${state.roomId === r.id ? ' is-on' : ''}"
                data-room="${r.id}" aria-pressed="${state.roomId === r.id}">
        <span class="bk-roomcard__top">
          <b>${esc(r.name)}</b>
          <i class="bk-roomcard__check" aria-hidden="true">✓</i>
        </span>
        <span class="bk-roomcard__meta">${esc(meta)}</span>
        <span class="bk-roomcard__strip" aria-hidden="true">${strip}</span>
      </button>`;
    }).join('');

    $$('[data-room]', host).forEach(btn => {
      btn.addEventListener('click', () => {
        state.roomId = btn.dataset.room;
        state.slotIdx = null;
        renderRooms();
        renderLanes();
        renderSummary();
        const step = $('#bk-step-slot');
        if (step) step.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /** 选时段：只显示选中的那一间面试间 */
  function renderLanes() {
    const host = $('#bk-board');
    const empty = $('#bk-slot-empty');
    if (!host) return;
    const r = room();

    if (!r) {
      if (empty) empty.hidden = false;
      host.innerHTML = '';
      return;
    }
    if (empty) empty.hidden = true;

    const d = parseYmd(state.date);
    const slots = SLOTS.map((s, si) => {
      const st = cellState(state.placeId, r, state.date, si);
      const mine = st === 'free' && isMine(state.placeId, r.id, state.date, si);
      const on = state.roomId === r.id && state.slotIdx === si;
      const dis = (st === 'closed' || mine) ? ' disabled' : '';
      const label = mine ? '你已约' : (st === 'closed' ? '不开放' : '');
      const cls = mine ? 'is-mine' : `is-${st}`;
      return `<button type="button" class="bk-slot ${cls}${on ? ' is-on' : ''}"
              data-room="${r.id}" data-slot="${si}"${dis}
              title="${esc(r.name)} ${s} · ${mine ? '你已约' : (st === 'closed' ? '不开放' : '可约')}"
              aria-label="${esc(r.name)} ${s} ${mine ? '你已约' : (st === 'closed' ? '不开放' : '可约')}">
              <b>${s}</b><small>${label}</small></button>`;
    }).join('');

    host.innerHTML = `
      <div class="bk-board__head">
        <b>${esc(r.name)}</b>
        <span>${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]}</span>
      </div>
      <div class="bk-track">${slots}</div>`;

    $$('.bk-slot', host).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        state.roomId = btn.dataset.room;
        state.slotIdx = Number(btn.dataset.slot);
        renderLanes();
        renderSummary();
        const form = $('#bk-form');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  /* ---------------- 4. 摘要 / 底栏 ---------------- */

  function renderSummary() {
    const p = place();
    const r = room();
    const s = slot();
    const body = $('#bk-sum-body');
    const btn  = $('#bk-sum-btn');
    const bar  = $('#bk-bar');

    if (!r || s == null) {
      if (body) {
        body.innerHTML = `<p class="bk-sum__empty">还没选场次。<br>先挑地点和日期，再在下方选一个空闲时段。</p>`;
      }
      if (btn) { btn.disabled = true; btn.textContent = '选好场次就能约'; }
      const sp = $('#bk-submit-price');
      if (sp) sp.textContent = '到店付';
      const ss = $('#bk-sum-state');
      if (ss) ss.textContent = '未选择';
      const pk = $('#bk-pick');
      if (pk) { pk.hidden = true; pk.innerHTML = ''; }
      if (bar) bar.classList.remove('is-on');
      return;
    }

    const price = PRICE;
    const d = parseYmd(state.date);
    const dateText = `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]}`;

    if (body) {
      body.innerHTML = `
        <div class="bk-sum__row"><span class="bk-sum__k">地点</span><span class="bk-sum__v">${esc(p.name)}</span></div>
        <div class="bk-sum__row"><span class="bk-sum__k">日期</span><span class="bk-sum__v">${esc(dateText)}</span></div>
        <div class="bk-sum__row"><span class="bk-sum__k">时间</span><span class="bk-sum__v">${s} - ${slotEnd(s)}<small>整场 ${DURATION_MIN} 分钟</small></span></div>
        <div class="bk-sum__row"><span class="bk-sum__k">面试间</span><span class="bk-sum__v">${esc(r.name)}</span></div>
        <div class="bk-sum__price"><span>场次费</span><b>${money(price)}</b></div>
        <p class="bk-sum__note">学生持学生证再减 ${money(STUDENT_OFF)}，改期与取消免费。</p>`;
    }
    if (btn) { btn.disabled = false; btn.textContent = '去填信息'; }
    const sp = $('#bk-submit-price');
    if (sp) sp.textContent = money(price);
    const ss = $('#bk-sum-state');
    if (ss) ss.textContent = p.name;
    const pk = $('#bk-pick');
    if (pk) {
      pk.hidden = false;
      pk.innerHTML = `<span class="bk-pick__k">已选</span>
        <span>${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]} <b>${s} - ${slotEnd(s)}</b></span>
        <span>· ${esc(r.name)}</span>
        <span>· <b>${money(price)}</b> 到店付</span>`;
    }

    if (bar) {
      const bi = $('#bk-bar-i');
      if (bi) bi.innerHTML = `<b>${esc(p.name)} · ${esc(r.name)}</b><span>${d.getMonth() + 1}/${d.getDate()} ${s}-${slotEnd(s)} · ${money(price)} 到店付</span>`;
      bar.classList.add('is-on');
    }
  }

  /* ---------------- 表单 ---------------- */

  const RULES = [
    { id: 'bk-f-name',  test: v => v.trim().length >= 2, msg: '请填写真实姓名（至少 2 个字）' },
    { id: 'bk-f-phone', test: v => /^1[3-9]\d{9}$/.test(v.trim()), msg: '手机号填一下，11 位数字，到店要核销' },
    { id: 'bk-f-email', test: v => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: '邮箱格式不太对' },
    { id: 'bk-f-role',  test: v => v.trim().length >= 2, msg: '写一下你想练的岗位，面试官会照着这个准备' },
  ];

  function validate() {
    let ok = true;
    RULES.forEach(rule => {
      const el = $(`#${rule.id}`);
      if (!el) return;
      const err = $(`#${rule.id}-err`);
      const good = rule.test(el.value);
      el.classList.toggle('is-bad', !good);
      if (err) err.classList.toggle('is-on', !good);
      if (!good && ok) { el.focus(); ok = false; }
    });
    return ok;
  }

  RULES.forEach(rule => {
    const el = $(`#${rule.id}`);
    if (!el) return;
    el.addEventListener('blur', () => {
      const err = $(`#${rule.id}-err`);
      const good = rule.test(el.value);
      el.classList.toggle('is-bad', !good);
      if (err) err.classList.toggle('is-on', !good);
    });
    el.addEventListener('input', () => {
      if (el.classList.contains('is-bad')) {
        const err = $(`#${rule.id}-err`);
        el.classList.remove('is-bad');
        if (err) err.classList.remove('is-on');
      }
    });
  });

  function submitBooking(e) {
    e.preventDefault();
    if (!state.roomId || state.slotIdx == null) {
      say('<b>还没选场次。</b>回到排班表点一盏亮着的灯。');
      return;
    }
    if (!validate()) { say('<b>有几项还得改一下。</b>'); return; }

    const p = place();
    const r = room();
    const s = slot();
    const code = makeCode(state.date);
    const bk = {
      code,
      placeId: p.id,
      placeName: p.name,
      addr: p.addr,
      roomId: r.id,
      roomName: r.name,
      date: state.date,
      slot: s,
      end: slotEnd(s),
      price: PRICE,
      name: $('#bk-f-name').value.trim(),
      phone: $('#bk-f-phone').value.trim(),
      email: $('#bk-f-email').value.trim(),
      role: $('#bk-f-role').value.trim(),
      note: $('#bk-f-note').value.trim(),
      status: 'booked',
      createdAt: Date.now(),
    };

    const list = bookings();
    list.push(bk);
    saveBookings(list);

    renderDone(bk);
    renderDays();
    renderRooms();
    renderLanes();
    updateMineCount();
    say('预约成功，<b>预约码已生成</b>，到店出示即可。');
  }

  /* ---------------- 确认卡 ---------------- */

  function renderDone(bk) {
    const host = $('#bk-done');
    const form = $('#bk-form');
    if (!host) return;
    const d = parseYmd(bk.date);
    host.hidden = false;
    host.innerHTML = `
      <div class="bk-done__flag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>
        预约成功
      </div>
      <p class="bk-done__code">${esc(bk.code)}</p>
      <p class="bk-done__codelabel">于面试间扫码签到，出示此码即可</p>
      <div class="bk-done__list">
        <div class="bk-done__row"><span>地点</span><b>${esc(bk.placeName)}</b></div>
        <div class="bk-done__row"><span>地址</span><b>${esc(bk.addr)}</b></div>
        <div class="bk-done__row"><span>时间</span><b>${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]} ${bk.slot} - ${bk.end}</b></div>
        <div class="bk-done__row"><span>面试间</span><b>${esc(bk.roomName)}</b></div>
        <div class="bk-done__row"><span>岗位</span><b>${esc(bk.role)}</b></div>
        <div class="bk-done__row"><span>费用</span><b>${money(bk.price)}（到店付）</b></div>
      </div>
      <div class="bk-done__acts">
        <button type="button" class="is-primary" data-act="ics" data-code="${esc(bk.code)}">加到日历</button>
        <button type="button" data-act="copy" data-code="${esc(bk.code)}">复制预约详情</button>
        <button type="button" data-act="cancel" data-code="${esc(bk.code)}">取消预约</button>
      </div>
      <p class="bk-done__tip">请于预约时段开始前 10 分钟到场，在面试间内使用上述预约码扫码签到。迟到超过 10 分钟的视为放弃本次预约。录像回放将于面试结束后 10 分钟内生成，并发送至预约时填写的电子邮箱。</p>`;
    if (form) form.hidden = true;

    host.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.code;
        const rec = bookings().find(b => b.code === code);
        if (!rec) return;
        if (btn.dataset.act === 'ics') downloadICS(rec);
        if (btn.dataset.act === 'copy') copyText(detailText(rec), '预约详情已复制，发给同伴或存到备忘录。');
        if (btn.dataset.act === 'cancel') cancelBooking(rec);
      });
    });
  }

  function detailText(b) {
    const d = parseYmd(b.date);
    return [
      `【职面通 线下面试间】`,
      `预约码：${b.code}`,
      `地点：${b.placeName}`,
      `地址：${b.addr}`,
      `时间：${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]} ${b.slot} - ${b.end}`,
      `面试间：${b.roomName}`,
      `岗位：${b.role}`,
      `费用：${money(b.price)}（到店付）`,
    ].join('\n');
  }

  function copyText(text, okMsg) {
    const done = () => say(okMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { say('复制没成功，手动选中这段文字吧。'); }
      document.body.removeChild(ta);
    }
  }

  /* ---------------- 日历导出 ---------------- */

  function icsStamp(dateStr, time) {
    const d = parseYmd(dateStr);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${time.replace(':', '')}00`;
  }

  function downloadICS(b) {
    const now = new Date();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Zhimiantong//Offline Interview Room//CN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${b.code}@zhimiantong`,
      `DTSTAMP:${icsStamp(ymd(new Date()), `${pad(now.getHours())}:${pad(now.getMinutes())}`)}`,
      `DTSTART:${icsStamp(b.date, b.slot)}`,
      `DTEND:${icsStamp(b.date, b.end)}`,
      `SUMMARY:职面通 线下面试间 · ${b.roomName}`,
      `LOCATION:${b.addr}`,
      `DESCRIPTION:预约码 ${b.code}\\n岗位 ${b.role}\\n提前 10 分钟到场`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `职面通面试间-${b.code}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    say('日历文件已下载，<b>用系统日历打开就能加进去</b>。');
  }

  /* ---------------- 取消 ---------------- */

  function cancelBooking(b) {
    const list = bookings();
    const rec = list.find(x => x.code === b.code);
    if (rec) rec.status = 'canceled';
    saveBookings(list);
    const host = $('#bk-done');
    if (host) host.hidden = true;
    const form = $('#bk-form');
    if (form) form.hidden = false;
    renderDays();
    renderRooms();
    renderLanes();
    renderSummary();
    updateMineCount();
    renderDrawer();
    say('预约已取消，<b>不收任何费用</b>。');
  }

  /* ---------------- 我的预约抽屉 ---------------- */

  function updateMineCount() {
    const n = bookings().filter(b => b.status === 'booked').length;
    const el = $('#bk-mine-n');
    if (el) { el.textContent = n; el.hidden = n === 0; }
  }

  function renderDrawer() {
    const body = $('#bk-drawer-body');
    if (!body) return;
    const list = bookings().slice().sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
    if (!list.length) {
      body.innerHTML = `<div class="bk-drawer__empty">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        还没有预约。<br>选个面试间和时段，约一场 40 分钟的线下面试。
      </div>`;
      return;
    }
    const now = new Date();
    body.innerHTML = list.map(b => {
      const d = parseYmd(b.date);
      const past = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 24) < now;
      const canceled = b.status === 'canceled';
      const st = canceled ? '已取消' : (past ? '已过期' : '待到店');
      const cls = canceled ? ' is-canceled' : (past ? ' is-past' : '');
      return `<div class="bk-bk${cls}">
        <div class="bk-bk__top">
          <span class="bk-bk__code">${esc(b.code)}</span>
          <span class="bk-bk__st">${st}</span>
        </div>
        <p class="bk-bk__line">${esc(b.placeName)} · ${esc(b.roomName)}<br>
          ${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_CN[d.getDay()]} ${b.slot} - ${b.end}<br>
          ${esc(b.role)} · ${money(b.price)}</p>
        <div class="bk-bk__acts">
          <button type="button" data-act="ics" data-code="${esc(b.code)}">加到日历</button>
          <button type="button" data-act="copy" data-code="${esc(b.code)}">复制详情</button>
          ${canceled || past ? '' : `<button type="button" class="is-danger" data-act="cancel" data-code="${esc(b.code)}">取消</button>`}
        </div>
      </div>`;
    }).join('');

    $$('[data-act]', body).forEach(btn => {
      btn.addEventListener('click', () => {
        const rec = bookings().find(b => b.code === btn.dataset.code);
        if (!rec) return;
        if (btn.dataset.act === 'ics') downloadICS(rec);
        if (btn.dataset.act === 'copy') copyText(detailText(rec), '预约详情已复制。');
        if (btn.dataset.act === 'cancel') cancelBooking(rec);
      });
    });
  }

  function openDrawer(open) {
    const d = $('#bk-drawer');
    const m = $('#bk-drawer-mask');
    if (!d) return;
    if (open) renderDrawer();
    d.classList.toggle('is-open', open);
    if (m) m.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    const cb = $('#bk-drawer-close');
    if (cb) cb.setAttribute('aria-expanded', String(open));
  }

  /* ---------------- 绑定 ---------------- */

  function init() {
    renderPlaces();
    renderDays();
    renderRooms();
    renderLanes();
    renderSummary();
    updateMineCount();

    const form = $('#bk-form');
    if (form) form.addEventListener('submit', submitBooking);

    const sumBtn = $('#bk-sum-btn');
    if (sumBtn) {
      sumBtn.addEventListener('click', () => {
        const f = $('#bk-form');
        if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const n = $('#bk-f-name');
        if (n) setTimeout(() => n.focus({ preventScroll: true }), 380);
      });
    }

    const barBtn = $('#bk-bar-b');
    if (barBtn) {
      barBtn.addEventListener('click', () => {
        const f = $('#bk-form');
        if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    const mine = $('#bk-mine');
    if (mine) mine.addEventListener('click', () => openDrawer(true));
    const close = $('#bk-drawer-close');
    if (close) close.addEventListener('click', () => openDrawer(false));
    const mask = $('#bk-drawer-mask');
    if (mask) mask.addEventListener('click', () => openDrawer(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') openDrawer(false); });

    // 页面重新可见时同步一次（可能隔天回来）
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { renderDays(); renderLanes(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
