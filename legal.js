/* 법적 고지 페이지(privacy/ 등) 공통 스크립트 : GNB 글래스 렌즈 + 데스크톱에서는 로고만 보이는 알약으로 접혀 있다가 hover/포커스 시 메뉴 펼침 (메인과 동일 동작, 인트로 없음) */
(() => {
  const gnb = document.getElementById('gnb');
  if (!gnb) return;
  // 메인(main.js)과 같이 스크롤바를 뺀 실제 폭을 --vw 로 넘겨 GNB 가 정확히 가운데 오게
  const setVw = () => document.documentElement.style.setProperty('--vw', document.documentElement.clientWidth + 'px');
  setVw(); window.addEventListener('resize', setVw);

  if (window.PivitGlass) {
    const glass = PivitGlass.mountField(gnb, { bend: 1.0, dispersion: 1.05, rim: 0.61, blur: 0.6 });
    window.addEventListener('load', () => glass.refit());
  }

  const nav = gnb.querySelector('.gnb__nav');
  const logo = gnb.querySelector('.gnb__logo');
  const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const mobileMq = window.matchMedia('(max-width: 834px)');
  const canCollapse = () => hoverMq.matches && !mobileMq.matches;
  const compactWidth = () => { const cs = getComputedStyle(gnb); return logo.offsetWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); };
  // 펼친 폭 = 패딩 + 로고 + gap + 메뉴. (폭을 auto 로 바꿨다 되돌리며 재면 트랜지션 시작값이 auto 가 돼 애니메이션 없이 즉시 커진다)
  const measureFull = () => { const cs = getComputedStyle(gnb); return parseFloat(cs.paddingLeft) + logo.offsetWidth + parseFloat(cs.columnGap || cs.gap || '0') + nav.offsetWidth + parseFloat(cs.paddingRight); };
  const ease = 'cubic-bezier(0.34, 1.25, 0.64, 1)';   // iOS 스프링 느낌의 오버슈트 (main.js 의 back.out 과 맞춤)
  let collapsed = false, hover = false;
  const collapse = (animate = true) => {
    if (!canCollapse()) return;
    collapsed = true;
    nav.style.pointerEvents = 'none';
    nav.style.transition = animate ? 'opacity .2s ease-in' : 'none'; nav.style.opacity = '0';
    gnb.style.transition = animate ? `width .6s ${ease}` : 'none';
    gnb.style.width = gnb.offsetWidth + 'px';           // 현재 폭에서 출발
    requestAnimationFrame(() => { gnb.style.width = compactWidth() + 'px'; });
  };
  const expand = () => {
    collapsed = false;
    nav.style.pointerEvents = '';
    gnb.style.transition = `width .6s ${ease}`;
    gnb.style.width = measureFull() + 'px';
    nav.style.transition = 'opacity .3s ease-out .12s'; nav.style.opacity = '1';
    const done = () => { if (!collapsed) gnb.style.width = ''; gnb.removeEventListener('transitionend', done); };
    gnb.addEventListener('transitionend', done);
  };
  const sync = () => { if (canCollapse()) { if (!hover) collapse(); } else { nav.style.opacity = ''; nav.style.pointerEvents = ''; gnb.style.width = ''; collapsed = false; } };
  // hover 는 mouseenter + mousemove 로 잡고(커서가 가만히 있는 자리로 접힌 경우 대비), 포커스는 키보드(:focus-visible)일 때만 펼친다 — main.js 와 동일
  const hoverOn = () => { hover = true; if (canCollapse() && collapsed) expand(); };
  gnb.addEventListener('mouseenter', hoverOn);
  gnb.addEventListener('mousemove', hoverOn);
  gnb.addEventListener('mouseleave', () => { hover = false; collapse(); });
  gnb.addEventListener('focusin', (e) => { if (canCollapse() && e.target.matches(':focus-visible')) expand(); });
  gnb.addEventListener('focusout', (e) => { if (!gnb.contains(e.relatedTarget) && !hover) collapse(); });
  mobileMq.addEventListener('change', sync); hoverMq.addEventListener('change', sync);
  // 첫 표시는 애니메이션 없이 접힌 상태로 (폰트 로드 후 폭이 바뀔 수 있어 load 에서 한 번 더)
  collapse(false);
  window.addEventListener('load', () => { if (collapsed) { gnb.style.transition = 'none'; gnb.style.width = compactWidth() + 'px'; } });
})();
