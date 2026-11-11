/* 맨 위로 · 맨 아래로 버튼 (첫 화면 · 법적 고지 · 공고 공통)
   GNB 와 같은 다크 글래스(glass.js 렌즈 · 림 하이라이트) 동그란 버튼 둘을 화면 오른쪽 아래에 세로로 띄운다.
   - 히어로를 반쯤 지나면 나타나고, 맨 위 근처에서는 숨는다. 맨 아래에 닿으면 «맨 아래로»는 흐려지고 눌리지 않는다.
   - 모달이 열려 페이지가 잠긴 동안(html.is-locked)은 CSS 가 숨긴다.
   - 첫 화면은 GSAP ScrollToPlugin 으로(앵커 이동과 같은 곡선), 그 밖의 페이지와 «움직임 줄이기»는 브라우저 스크롤로 간다.
   JS 가 없으면 버튼 자체를 만들지 않는다(눌러도 동작하지 않는 버튼을 두지 않는다). */
(() => {
  const ICON = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/></svg>';

  const nav = document.createElement('nav');
  nav.className = 'scroll-nav is-hidden';
  nav.setAttribute('aria-label', '페이지 이동');
  nav.innerHTML =
    '<button type="button" class="scroll-nav__btn scroll-nav__btn--top" aria-label="맨 위로">' + ICON + '</button>' +
    '<button type="button" class="scroll-nav__btn scroll-nav__btn--bottom" aria-label="맨 아래로">' + ICON + '</button>';
  document.body.appendChild(nav);
  const topBtn = nav.querySelector('.scroll-nav__btn--top');
  const bottomBtn = nav.querySelector('.scroll-nav__btn--bottom');

  if (window.PivitGlass) {
    const lenses = [topBtn, bottomBtn].map((el) => PivitGlass.mountField(el, { bend: 1.0, dispersion: 1.05, rim: 0.61, blur: 0.6 }));
    window.addEventListener('load', () => lenses.forEach((l) => l.refit()));
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const go = (y) => {
    if (window.gsap && window.ScrollToPlugin && !reduce.matches) {
      gsap.to(window, { duration: 1, ease: 'power2.inOut', scrollTo: { y, autoKill: true }, overwrite: true });
    } else {
      window.scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
    }
  };
  topBtn.addEventListener('click', () => go(0));
  bottomBtn.addEventListener('click', () => { if (bottomBtn.getAttribute('aria-disabled') !== 'true') go(maxY()); });

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const show = y > window.innerHeight * 0.5;
    nav.classList.toggle('is-hidden', !show);
    nav.inert = !show;                                   // 숨은 동안 탭 키로 들어가지 않게
    const atBottom = maxY() - y < 4;
    bottomBtn.setAttribute('aria-disabled', atBottom ? 'true' : 'false');
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', update);
  update();
})();
