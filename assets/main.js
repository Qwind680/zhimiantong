/* 职面通 · 首页交互
   1) 导航吸顶状态  2) 移动菜单  3) 未上线模块提示  4) 滚动进场 */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---- 1. 吸顶 ---- */
  const nav = $('.zt-nav');
  if (nav) {
    const sync = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
    sync();
    addEventListener('scroll', sync, { passive: true });
  }

  /* ---- 2. 移动菜单 ---- */
  const burger = $('#zt-burger');
  const menu   = $('#zt-menu');
  if (burger && menu) {
    const setMenu = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
      menu.hidden = !open;
    };
    burger.addEventListener('click', () => {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });
    // 视口回到桌面尺寸时收起
    matchMedia('(min-width: 1081px)').addEventListener('change', (e) => {
      if (e.matches) setMenu(false);
    });
  }

  /* ---- 3. 未上线提示 ---- */
  const SAYS = {
    '登录':     '账号系统还没开放，现在所有模块都免登录试用。',
    '开始准备': '第一步是上传简历——这个功能正在打磨，先等等。',
    '产品说明': '产品说明文档还在写。',
    '联系我们': '联系方式还没挂上，账号系统上线时一起开。',
    '用户协议': '用户协议还在起草，上线前会发给你确认。',
    '反馈':     '反馈通道等账号系统上线后一起开。',
  };

  const toast  = $('#zt-toast');
  let   timer  = 0;

  function say(name) {
    if (!toast) return;
    const text = SAYS[name] || `<b>${name}</b>正在路上。`;
    toast.innerHTML = text.replace(/<(.+?)>/g, '<b>$1</b>');
    toast.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('is-on'), 3600);
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-coming]');
    if (trigger) say(trigger.dataset.coming);
  });

  /* ---- 4. 进场 ---- */
  const items = $$('.zt-reveal');
  items.forEach((el) => el.style.setProperty('--i', el.dataset.i || 0));

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  items.forEach((el) => io.observe(el));

  /* ---- Hero 首屏立即进场，不等滚动 ---- */
  requestAnimationFrame(() => {
    $$('.zt-hero .zt-reveal').forEach((el) => el.classList.add('is-in'));
  });
})();
