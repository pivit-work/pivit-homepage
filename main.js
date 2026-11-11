/* pivit public website — scroll motion (GSAP + ScrollTrigger) */
(function () {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const review = location.search.includes('review');
  if (review) document.documentElement.classList.add('review');
  /* 지연 배경: .bg-defer 요소가 뷰포트 1.5화면 안으로 들어오면 .is-near → CSS 배경 로드 (review 모드·IO 미지원이면 즉시) */
  const deferred = Array.from(document.querySelectorAll('.bg-defer'));
  if (!('IntersectionObserver' in window) || review) deferred.forEach((el) => el.classList.add('is-near'));
  else {
    // 가까워지면 배경을 켜고, 안의 lazy 이미지(숨겨진 섹션 3 패널 등)도 미리 받아 둔다 → 탭 전환 시 빈 화면 없음
    const bgIO = new IntersectionObserver((entries) => { entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-near'); en.target.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }); bgIO.unobserve(en.target); } }); }, { rootMargin: '150% 0px' });
    deferred.forEach((el) => bgIO.observe(el));
  }
  const MOBILE = window.matchMedia('(max-width: 834px)').matches;   // 모바일 분기 (CSS 브레이크포인트 834 와 동일)
  const shift = new URLSearchParams(location.search).get('shift');
  if (shift) document.body.style.marginTop = (-parseInt(shift, 10)) + 'px';

  /* ---------- 고정 Early Access 버튼 : 콘텐츠 안 버튼이 보일 때는 숨김 ---------- */
  // 콘텐츠 안 Early Access 버튼(히어로·푸터)이 20% 이상 보이거나, 푸터가 화면에 들어오면 끝까지 숨김
  const fixedCta = document.querySelector('.cta--fixed');
  const inlineCtas = Array.from(document.querySelectorAll('.cta:not(.cta--fixed):not(.ea-modal__cta)'));   // 모달 안 버튼은 항상 뷰포트 안에 있어 제외
  const footer = document.querySelector('.footer');
  if (fixedCta && inlineCtas.length) {
    const visible = new Set();
    const apply = () => fixedCta.classList.toggle('is-hidden', visible.size > 0);
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
      apply();
    }, { threshold: 0.2 });
    inlineCtas.forEach((el) => cio.observe(el));
    if (footer) {
      const fio = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) visible.add(footer); else visible.delete(footer); });
        apply();
      }, { threshold: 0 });
      fio.observe(footer);
    }
  }

  /* ---------- FAQ : 하나만 열기 + 펼침 0.3s(easeOutQuad) / 접힘 0.1s ---------- */
  const faqItems = Array.from(document.querySelectorAll('.faq__item'));
  const faqAnimated = window.gsap && !reduce && !review;
  const faqOpen = (d) => {
    const a = d.querySelector('.faq__a');
    d.open = true; d.classList.add('is-open');
    gsap.killTweensOf(a);
    gsap.fromTo(a, { height: 0, opacity: 0, marginTop: 0 },
      { height: 'auto', opacity: 1, marginTop: 10, duration: 0.3, ease: 'power1.out', onComplete: () => gsap.set(a, { clearProps: 'height,opacity,marginTop' }) });
  };
  const faqClose = (d) => {
    const a = d.querySelector('.faq__a');
    d.classList.remove('is-open');
    gsap.killTweensOf(a);
    gsap.to(a, { height: 0, opacity: 0, marginTop: 0, duration: 0.1, ease: 'power1.out',
      onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'height,opacity,marginTop' }); } });
  };
  /* 데스크톱 FAQ 는 고정 높이(푸터가 밀리지 않게). 답변 길이가 달라도 넘치지 않도록 '가장 긴 답변을 연 상태'의 높이를 재서 예약한다 (Figma 745*u 보다 작아지진 않음) */
  const faq = document.querySelector('.faq');
  const fitFaq = () => {
    if (!faq || !faqItems.length) return;
    if (window.matchMedia('(max-width: 834px)').matches) { faq.style.height = ''; return; }
    faq.style.height = '';
    const base = faq.getBoundingClientRect().height;             // CSS 고정 높이(745*u)
    const clone = faq.cloneNode(true);
    clone.style.cssText = 'position:absolute;left:0;top:0;width:' + faq.getBoundingClientRect().width + 'px;height:auto;visibility:hidden;pointer-events:none;margin:0;';
    clone.querySelectorAll('.faq__a').forEach((a) => a.removeAttribute('style'));
    faq.parentNode.appendChild(clone);
    const cItems = Array.from(clone.querySelectorAll('.faq__item'));
    let max = 0;
    cItems.forEach((ci) => { cItems.forEach((o) => { o.open = o === ci; }); max = Math.max(max, clone.getBoundingClientRect().height); });
    clone.remove();
    if (max > base + 0.5) faq.style.height = Math.ceil(max) + 'px';
  };
  let faqFitRaf = 0;
  const scheduleFitFaq = () => { cancelAnimationFrame(faqFitRaf); faqFitRaf = requestAnimationFrame(fitFaq); };
  fitFaq();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFitFaq);
  window.addEventListener('resize', scheduleFitFaq);
  faqItems.forEach((d) => {
    if (d.open) d.classList.add('is-open');
    if (!faqAnimated) {                                       // GSAP 없음/모션 축소: 네이티브 토글 + 하나만 열기
      d.addEventListener('toggle', () => { if (d.open) faqItems.forEach((o) => { if (o !== d) o.open = false; }); });
      return;
    }
    // 질문 텍스트가 아니라 항목 블록 전체가 클릭 영역 (답변 영역 클릭은 제외). summary 의 네이티브 토글은 막고 GSAP 으로 연다
    d.addEventListener('click', (e) => {
      if (e.target.closest('.faq__a')) return;
      e.preventDefault();
      if (d.classList.contains('is-open')) faqClose(d);
      else { faqItems.forEach((o) => { if (o !== d && o.classList.contains('is-open')) faqClose(o); }); faqOpen(d); }
    });
  });

  /* ---------- Video : 보이면 재생 ---------- */
  const video = document.querySelector('.video__player');
  if (video && video.querySelector('source')) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); });
    }, { threshold: 0.4 });
    vio.observe(video);
  }

  /* ---------- 반응형 스케일: --vw 를 스크롤바를 뺀 실제 폭으로 (CSS 기본값 100vw 는 스크롤바 포함) ---------- */
  // 데스크톱 레이아웃(835px+)은 900px 아래로 줄어들지 않는다: 900 기준으로 고정하고 가로 스크롤 (모바일 600 이하는 100% 유동)
  const DESKTOP_MIN = 900;
  // --vw: 레이아웃 폭(데스크톱은 최소 900), --cw: 실제 창 폭, --sx: 가로 스크롤 — GNB·고정 CTA 가 900 고정 레이아웃을 따라가도록 CSS 에서 사용
  const setVW = () => { const w = document.documentElement.clientWidth; const root = document.documentElement.style; root.setProperty('--vw', (w > 834 ? Math.max(w, DESKTOP_MIN) : w) + 'px'); root.setProperty('--cw', w + 'px'); root.setProperty('--sx', Math.round(window.scrollX) + 'px'); };
  setVW();
  window.addEventListener('resize', setVW);
  let lastSX = 0; window.addEventListener('scroll', () => { if (window.scrollX !== lastSX) { lastSX = window.scrollX; document.documentElement.style.setProperty('--sx', Math.round(lastSX) + 'px'); } }, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(setVW).observe(document.documentElement);

  /* ---------- Section 3 : 좌측 메뉴 탭 → 우측 화면 전환 (스크롤 비연동) ---------- */
  const s3Steps = Array.from(document.querySelectorAll('.s3__step'));
  const s3Panes = Array.from(document.querySelectorAll('.s3__pane'));
  const s3Tabs = Array.from(document.querySelectorAll('.s3__tab'));
  const s3Current = document.querySelector('.s3__current');
  let s3Active = 0;
  if (s3Steps.length && s3Panes.length) {
    const select = (idx, focus) => {
      s3Steps.forEach((li, i) => {
        const on = i === idx;
        li.classList.toggle('is-active', on);
        li.setAttribute('aria-selected', on ? 'true' : 'false');
        li.tabIndex = on ? 0 : -1;
        if (on && focus) li.focus();
      });
      s3Panes.forEach((pane, i) => { pane.classList.toggle('is-active', i === idx); pane.setAttribute('aria-hidden', i === idx ? 'false' : 'true'); });
      // 모바일 탭 + 현재 스텝 설명
      s3Tabs.forEach((t, i) => { t.classList.toggle('is-active', i === idx); t.setAttribute('aria-selected', i === idx ? 'true' : 'false'); });
      if (s3Current) {
        const li = s3Steps[idx];
        const icon = li.querySelector('.s3__icon--on'), name = li.querySelector('.s3__step-name'), desc = li.querySelector('.s3__step-head .body');
        s3Current.innerHTML = `<div class="s3__current-head"><img src="${icon ? icon.getAttribute('src') : ''}" width="30" height="30" alt="" /><b>${name ? name.textContent : ''}</b></div><p>${desc ? desc.textContent : ''}</p>`;
      }
      s3Active = idx;
    };
    s3Tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
    s3Steps.forEach((li, i) => {
      li.addEventListener('click', () => select(i));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % s3Steps.length, true); }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + s3Steps.length) % s3Steps.length, true); }
      });
    });
    select(0);
  }

  if (reduce || review || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  const EASE = 'power3.out';

  /* ---------- GNB : 처음부터 다크 글래스 (HTML 에 is-dark). 라이트 전환 없음 ---------- */
  const gnb = document.getElementById('gnb');

  /* ---------- GNB 글래스 렌즈 (glisse) : spread 필드 · Bend 1.0 · Dispersion 1.05 · Rim 0.61 ---------- */
  const glass = window.PivitGlass ? PivitGlass.mountField(gnb, { bend: 1.0, dispersion: 1.05, rim: 0.61, blur: 0.6 }) : null;
  // 우측 상단 고정 Early Access 버튼도 같은 렌즈 (Figma 61:3301 Glass)
  const ctaGlass = window.PivitGlass && fixedCta ? PivitGlass.mountField(fixedCta, { bend: 1.0, dispersion: 1.05, rim: 0.61, blur: 0.6 }) : null;
  window.addEventListener('load', () => { glass && glass.refit(); ctaGlass && ctaGlass.refit(); });

  /* ---------- GNB 꿀렁임 : 스크롤 속도에 따라 눌렸다가 탄성으로 복귀, 렌즈 굴절도 같이 출렁 ---------- */
  const wobble = { amount: 1 };
  let wobbleTl = null;
  let gnbIntro = null;                                 // 첫 로딩 인트로 타임라인 (아래 Hero 블록에서 생성)
  // k = 0~1 세기. 눌렸다가(0.12s) 탄성으로 복귀(1.1s), 렌즈 굴절량도 같이 출렁. 타임라인을 돌려주므로 인트로에 끼워 넣을 수 있다
  // settle / ease 로 복귀 길이·잔여 반동을 조절 (인트로 착지는 더 길고 크게)
  const mobileMq = window.matchMedia('(max-width: 834px)');   // 현재 레이아웃이 모바일인지 (GNB 축소·접힘 판단에 공용)
  let gnbScaleBase = 1;                                // 기본 배율 (모바일 스크롤 다운 시 0.7) — 꿀렁임은 이 값을 기준으로 눌렸다 돌아온다
  const makeWobble = (k, settle = 1.1, ease = 'elastic.out(1.1, 0.32)') => gsap.timeline()
    .to(gnb, { scaleX: () => gnbScaleBase * (1 + 0.045 * k), scaleY: () => gnbScaleBase * (1 - 0.11 * k), duration: 0.12, ease: 'power2.out' }, 0)
    .to(gnb, { scaleX: () => gnbScaleBase, scaleY: () => gnbScaleBase, duration: settle, ease }, 0.12)
    .to(wobble, { amount: Math.max(0, 1 - 0.5 * k), duration: 0.12, ease: 'power2.out',
      onUpdate: () => glass && glass.setAmount(wobble.amount) }, 0)
    .to(wobble, { amount: 1, duration: settle, ease,
      onUpdate: () => glass && glass.setAmount(wobble.amount) }, 0.12);
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const v = Math.abs(self.getVelocity());          // px/s
      if (v < 250) return;
      if (gnbIntro && gnbIntro.isActive()) return;     // 인트로 중에는 스크롤 꿀렁임 생략
      const k = Math.min(1, v / 3000);
      if (wobbleTl && wobbleTl.isActive() && wobbleTl.progress() < 0.25) return;
      wobbleTl = makeWobble(k);
    }
  });

  /* ---------- 모바일 GNB 축소 : 아래로 스크롤하면 70% (기준점 상단 중앙, CSS transform-origin), 위로 스크롤하거나 맨 위 근처면 100% ---------- */
  // 로드 시점의 MOBILE 상수가 아니라 현재 폭(mobileMq)으로 판단 — 좁은 창에서 열고 넓히면 데스크톱에서도 줄어들던 문제 방지
  const applyGnbScale = (want) => {
    if (want === gnbScaleBase) return;
    gnbScaleBase = want;
    gsap.to(gnb, { scaleX: want, scaleY: want, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  };
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      if (!mobileMq.matches) { applyGnbScale(1); return; }
      const y = self.scroll();
      applyGnbScale(y <= 40 ? 1 : (self.direction === 1 ? 0.7 : (self.direction === -1 ? 1 : gnbScaleBase)));
    }
  });
  mobileMq.addEventListener('change', () => { if (!mobileMq.matches) applyGnbScale(1); });

  /* ---------- 앵커 링크 : GSAP ScrollTo (pin 구간과 호환되는 스무스 스크롤) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = id ? document.getElementById(id) : document.body;
      if (!target) return;
      e.preventDefault();
      if (window.eaModalClose) window.eaModalClose();            // Early Access 모달이 열려 있으면 닫고 이동
      // 섹션 상단을 뷰포트 맨 위에 붙이면 제목이 고정 GNB 뒤에 숨는다 → GNB 아래 여백(GNB 하단 + 48)만큼 내려서 멈춘다
      const gnbEl = document.getElementById('gnb');
      const offsetY = id ? Math.round((gnbEl ? gnbEl.getBoundingClientRect().bottom : 0) + 48) : 0;
      gsap.to(window, { duration: 1, ease: 'power2.inOut', scrollTo: { y: id ? target : 0, offsetY, autoKill: false },
        onComplete: () => { history.replaceState(null, '', id ? '#' + id : location.pathname); ScrollTrigger.update(); } });
    });
  });

  /* ---------- Hero : 진입 시 순차 등장 (타이틀은 아래 .split-lines 글자 애니메이션이 같은 순서 슬롯(두 번째, 0.24s)에서 담당) ---------- */
  const HERO_STAGGER = 0.14, HERO_DELAY = 0.1;
  // 히어로 타이틀 글자 애니메이션은 다른 섹션(0.8s / 8ms)의 2배 길이. 타이틀 뒤 항목들은 그 늘어난 만큼(HERO_TITLE_EXTRA) 늦게 시작
  const HERO_TITLE_DUR = 1.6, HERO_TITLE_STAGGER = 0.016, HERO_TITLE_EXTRA = 0.5;   // 타이틀이 거의 다 보일 즈음 아래 텍스트가 이어지도록 0.5
  const heroItems = Array.from(document.querySelectorAll('.hero__content > *'));
  const heroTitleIndex = heroItems.findIndex((el) => el.classList.contains('split-lines'));
  const heroDelay = (i) => HERO_DELAY + HERO_STAGGER * i + (heroTitleIndex >= 0 && i > heroTitleIndex ? HERO_TITLE_EXTRA : 0);
  heroItems.forEach((el, i) => {
    if (el.classList.contains('split-lines')) return;
    gsap.fromTo(el, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: EASE, delay: heroDelay(i) });
  });
  /* GNB 인트로 : 히어로 마지막 항목이 거의 다 나타난 시점에, 로고만 있는 작은 알약이 화면 위에서 떨어져 살짝 반동하며 착지(착지 순간 꿀렁임) → 메뉴 폭으로 펼쳐지며 메뉴가 나타난다
     (CSS .gnb--intro 가 그 전까지 위에 숨겨 둠. 폭은 펼침 직전에 실측해 폰트 로딩 전후 차이를 피하고, 끝나면 인라인 폭을 지워 auto 로) */
  const heroEnd = heroDelay(Math.max(0, heroItems.length - 1)) + 1;
  const gnbNav = gnb.querySelector('.gnb__nav');
  const gnbLogo = gnb.querySelector('.gnb__logo');
  const compactWidth = () => { const cs = getComputedStyle(gnb); return gnbLogo.offsetWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); };
  let fullWidth = 0;
  gsap.set(gnb, { y: -(gnb.offsetHeight + 80), width: compactWidth() });
  gsap.set(gnbNav, { opacity: 0 });
  gnb.classList.remove('gnb--intro');
  // 현재 인라인 폭을 잠시 풀고 메뉴까지 포함한 자연 폭을 잰다 (동기 처리라 화면에 그려지지 않음)
  const measureFull = () => { const prev = gnb.style.width; gnb.style.width = 'auto'; const w = gnb.offsetWidth; gnb.style.width = prev; return w; };
  gnbIntro = gsap.timeline({ delay: heroEnd - 0.3 })
    .to(gnb, { y: 0, duration: 0.5, ease: 'back.out(1.3)' }, 0)              // 빠르게 떨어져 작은 반동으로 착지 (제자리에 처음 닿는 시점 ≈ 0.22s)
    .add(makeWobble(0.8), 0.22)                                                // 닿는 순간부터 꿀렁임 : 스크롤 때와 같은 세기·복귀(1.1s) (+ 렌즈 굴절 출렁)
    .call(() => { fullWidth = measureFull(); }, null, 0.54)
    .to(gnb, { width: () => fullWidth, duration: 0.8, ease: 'back.out(1.0)' }, 0.55)   // 인트로 펼침도 같은 반동
    .to(gnbNav, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 1.0)
    .call(() => { gnbIntroDone = true; gsap.delayedCall(2, () => { if (!gnbHover) collapseGnb(); }); }, null, 1.45); // 펼쳐진 뒤 2초 후 로고만 남기고 접힘

  /* GNB 접힘/펼침 : 인트로 후 로고만 보이는 알약으로 접혀 있다가, 마우스를 올리면(또는 키보드 포커스) 메뉴 폭으로 펼쳐진다. hover 가 없는 터치 기기에서는 항상 펼친 상태 */
  let gnbIntroDone = false, gnbHover = false, gnbCollapsed = false;
  // 접힘은 데스크톱 레이아웃(835px+) + 마우스 환경에서만. 모바일 레이아웃/터치는 호버가 없으니 항상 펼친 상태
  const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const canCollapse = () => hoverMq.matches && !mobileMq.matches;
  const expandGnb = () => {
    gnbCollapsed = false;
    gsap.killTweensOf([gnb, gnbNav]);
    gnbNav.style.pointerEvents = '';
    // iOS 스프링처럼 목표 폭을 살짝 넘겼다가 돌아오는 반동 (back.out)
    gsap.to(gnb, { width: measureFull(), duration: 0.6, ease: 'back.out(1.05)', onComplete: () => gsap.set(gnb, { clearProps: 'width' }) });
    gsap.to(gnbNav, { opacity: 1, duration: 0.3, ease: 'power2.out', delay: 0.12 });
  };
  const collapseGnb = () => {
    if (!canCollapse()) return;
    gnbCollapsed = true;
    gsap.killTweensOf([gnb, gnbNav]);
    gnbNav.style.pointerEvents = 'none';                                       // 접힌 동안 알약 밖으로 넘친(투명) 메뉴가 hover 영역이 되지 않게
    gsap.to(gnbNav, { opacity: 0, duration: 0.2, ease: 'power2.in' });
    gsap.to(gnb, { width: compactWidth(), duration: 0.6, ease: 'back.out(0.9)' });   // 접힐 때도 살짝 더 줄었다가 제자리로
  };
  // hover 판단은 mouseenter 와 mousemove 둘 다: 커서가 가만히 있는 자리로 GNB 가 내려와 접힌 경우 mouseenter 가 안 와서, 그 상태에서 클릭하면
  // 로고 링크 포커스(focusin)로만 갑자기 펼쳐지는 일이 있었다 → 조금이라도 움직이면 hover 로 잡고, 포커스는 키보드(:focus-visible)일 때만 펼친다
  const gnbHoverOn = () => { gnbHover = true; if (gnbIntroDone && canCollapse() && gnbCollapsed) expandGnb(); };
  gnb.addEventListener('mouseenter', gnbHoverOn);
  gnb.addEventListener('mousemove', gnbHoverOn);
  gnb.addEventListener('mouseleave', () => { gnbHover = false; if (gnbIntroDone) collapseGnb(); });
  gnb.addEventListener('focusin', (e) => { if (gnbIntroDone && canCollapse() && e.target.matches(':focus-visible')) expandGnb(); });
  gnb.addEventListener('focusout', (e) => { if (gnbIntroDone && !gnb.contains(e.relatedTarget) && !gnbHover) collapseGnb(); });
  // 창 크기/입력 환경이 바뀌면 상태 맞추기: 모바일 폭으로 줄면 펼치고, 데스크톱으로 돌아오면 (호버 중이 아닐 때) 접는다
  const syncGnbCollapse = () => { if (!gnbIntroDone) return; if (canCollapse()) { if (!gnbHover) collapseGnb(); } else expandGnb(); };
  mobileMq.addEventListener('change', syncGnbCollapse);
  hoverMq.addEventListener('change', syncGnbCollapse);

  /* ---------- 공통 reveal : 섹션 헤더/비주얼/컬럼 ---------- */
  gsap.utils.toArray('.reveal').forEach((el) => {
    // 안에 글자 스플릿 타이틀(.split-lines)이 있는 헤드는 컨테이너를 페이드하지 않고(타이틀은 자체 애니메이션) 나머지 자식(부제 등)만 페이드
    if (el.querySelector('.split-lines')) {
      gsap.set(el, { opacity: 1 });
      const rest = Array.from(el.children).filter((c) => !c.classList.contains('split-lines'));
      if (rest.length) gsap.fromTo(rest,
        { y: 36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: EASE, scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } });
      return;
    }
    const cols = el.classList.contains('feat__cols') ? el.querySelectorAll('.feat__col') : null;
    if (cols && cols.length) {
      gsap.set(el, { opacity: 1 });
      gsap.from(cols, {
        y: 40, opacity: 0, duration: 0.9, ease: EASE, stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' }
      });
      return;
    }
    const isFigure = el.classList.contains('feat__figure');
    gsap.fromTo(el,
      { y: isFigure ? 60 : 36, opacity: 0, scale: isFigure ? 0.97 : 1 },
      { y: 0, opacity: 1, scale: 1, duration: isFigure ? 1.1 : 0.9, ease: EASE,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } });
  });

  /* ---------- 섹션 타이틀(.split-lines: 섹션 2·3·6~10) : 줄 마스크 + 글자 단위 슬라이드 업 (카드 헤드라인은 적용 안 함 — 사용자 지시) (GSAP 'Responsive line splits on scroll' 데모 방식, SplitText 3.13 autoSplit 으로 리사이즈 시 재분할) ---------- */
  let heroChars = [];                                       // 히어로 타이틀 글자 요소 (이모지 치환용, 재분할 때 갱신)
  let heroEmojiReset = null;
  if (window.SplitText) {
    gsap.utils.toArray('.split-lines').forEach((el) => {
      // 히어로 타이틀은 첫 화면이라 스크롤 트리거 대신 진입 시퀀스의 두 번째 슬롯 시점에 재생
      const inHero = el.closest('.hero__content');
      const heroIndex = inHero ? Array.prototype.indexOf.call(inHero.children, el) : -1;
      SplitText.create(el, {
        type: 'lines,chars', mask: 'lines', autoSplit: true,
        // 줄 마스크는 유지하고 글자 하나하나가 아주 짧은 간격(8ms)으로 올라온다
        onSplit: (self) => {
          gsap.set(el, { opacity: 1 });   // 히어로 CSS(.hero__content > * { opacity: 0 }) 해제 — 분할된 뒤에만 보이게 해 깜빡임 방지
          if (inHero) { heroChars = self.chars; heroChars.forEach((c) => { c.dataset.ch = c.textContent; c.dataset.display = c.style.display; }); heroEmojiReset && heroEmojiReset(); }
          return gsap.from(self.chars, {
            yPercent: 100, opacity: 0, ease: 'expo.out',
            duration: inHero ? HERO_TITLE_DUR : 0.8, stagger: inHero ? HERO_TITLE_STAGGER : 0.008,
            ...(inHero
              ? { delay: HERO_DELAY + HERO_STAGGER * heroIndex }
              : { scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } })
          });
        }
      });
    });
  }

  /* 한글 IME 타이핑 시뮬레이션 : 단어를 자모 키 입력 순서로 풀고, 키를 하나씩 누를 때 화면에 보이는 문자열을 돌려준다.
     예) 회사 → ㅎ, 호, 회, 횟, 회사 / 보여 → ㅂ, 보, 봉, 보여 (다음 글자 초성은 먼저 앞 글자 받침으로 붙었다가 모음이 오면 분리) */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
  const VOWEL_PAIR = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
  const JONG_PAIR = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  const joinVowel = (a, b) => Object.keys(VOWEL_PAIR).find((k) => VOWEL_PAIR[k] === a + b) || null;
  const joinJong = (a, b) => Object.keys(JONG_PAIR).find((k) => JONG_PAIR[k] === a + b) || null;
  const compose = (cho, jung, jong) => {
    if (!jung) return cho || '';
    return String.fromCharCode(0xAC00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + (jong ? JONG.indexOf(jong) : 0));
  };
  const typingSteps = (word) => {
    // 1) 키 입력 열거
    const keys = [];
    for (const ch of Array.from(word)) {
      const code = ch.charCodeAt(0) - 0xAC00;
      if (code < 0 || code > 11171) { keys.push({ raw: ch }); continue; }
      const cho = CHO[Math.floor(code / 588)], jung = JUNG[Math.floor((code % 588) / 28)], jong = JONG[code % 28].trim();
      keys.push({ c: cho });
      for (const v of (VOWEL_PAIR[jung] || jung)) keys.push({ v });
      if (jong) for (const j of (JONG_PAIR[jong] || jong)) keys.push({ c: j });
    }
    // 2) IME 상태 머신
    let done = '', cho = '', jung = '', jong = '';
    const flush = () => { done += compose(cho, jung, jong); cho = jung = jong = ''; };
    const steps = [];
    for (const key of keys) {
      if (key.raw) { flush(); done += key.raw; }
      else if (key.c) {
        if (cho && jung && !jong && JONG.indexOf(key.c) > 0) jong = key.c;                 // 받침으로
        else if (cho && jung && jong && joinJong(jong, key.c)) jong = joinJong(jong, key.c); // 겹받침
        else { flush(); cho = key.c; }
      } else {
        if (cho && !jung) jung = key.v;
        else if (cho && jung && !jong && joinVowel(jung, key.v)) jung = joinVowel(jung, key.v); // 복모음
        else if (cho && jung && jong) {                                                        // 받침이 다음 글자 초성으로 넘어감
          const pair = JONG_PAIR[jong]; let moved = jong;
          if (pair) { jong = pair[0]; moved = pair[1]; } else jong = '';
          flush(); cho = moved; jung = key.v;
        } else { flush(); done += key.v; }
      }
      steps.push(done + compose(cho, jung, jong));
    }
    return steps;
  };

  /* ---------- 히어로 타이틀 이모지 (Figma 67:3386) : 히어로가 보이는 상태에서 마우스 동작이 5초 없으면 회사→🏢, 사람→🧑‍💻, 시간→⏰, 보여→👀 를
     랜덤 순서로 2초에 하나씩 바꿔 보여 준다. 넷 다 바뀐 뒤에는 다시 랜덤 순서로 2초에 하나씩 이모지가 사라지고 글자가 한 자씩 타이핑되듯 돌아온다. 이 사이클을 마우스가 움직일 때까지 반복.
     마우스가 움직이면 즉시 전부 원문으로. 마우스 환경에서만 ---------- */
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle && window.SplitText && hoverMq.matches) {
    const WORDS = [['회사', '🏢'], ['사람', '🧑‍💻'], ['시간', '⏰'], ['보여', '👀']];
    const IDLE_MS = 5000, STEP_MS = 2000, TYPE_MS = 120;
    let idleTimer = null, timers = [], swapped = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const heroVisible = () => document.querySelector('.hero').getBoundingClientRect().bottom > 300;
    // 글자 요소 배열에서 단어(연속 글자)를 찾아 요소 묶음으로. 원래 글자(dataset.ch)로 비교 — 이미 이모지(서로게이트 2글자)로 바뀐 요소가 있어도 어긋나지 않게
    const findWord = (word) => {
      const letters = Array.from(word);
      for (let i = 0; i + letters.length <= heroChars.length; i++) {
        if (letters.every((ch, k) => heroChars[i + k].dataset.ch === ch)) return heroChars.slice(i, i + letters.length);
      }
      return null;
    };
    // 한 단어를 즉시 원문으로 (SplitText 가 글자에 준 inline-block 은 되살려야 한다 — 지우면 div 라 글자마다 줄바꿈)
    const putBack = (entry) => {
      entry.els.forEach((c) => { gsap.killTweensOf(c); c.style.display = c.dataset.display || ''; c.style.width = ''; c.style.textAlign = ''; c.style.opacity = ''; c.textContent = c.dataset.ch; gsap.set(c, { clearProps: 'transform,width,opacity' }); });
    };
    const finish = (entry) => { putBack(entry); swapped = swapped.filter((e) => e !== entry); };
    // 마우스가 움직이면 : 진행 중이던 사이클은 멈추고, 남은 이모지를 앞 단어부터 순서대로 하나씩 타이핑해 원문으로 되돌린다 (타이핑 중이던 단어는 바로 완성)
    let restoring = false;
    const typeBackAll = () => {
      clearTimers();
      swapped.filter((e) => e.typing).forEach(finish);
      const pending = swapped.slice().sort((a, b) => heroChars.indexOf(a.els[0]) - heroChars.indexOf(b.els[0]));
      if (!pending.length) return;
      restoring = true;
      let at = 0;
      pending.forEach((entry) => { later(() => toText(entry), at); at += 180 + TYPE_MS * typingSteps(entry.word).length + 120; });
      later(() => { restoring = false; }, at);
    };
    heroEmojiReset = () => { clearTimers(); swapped = []; };
    // 단어 → 이모지 (두 글자 폭에서 이모지 폭으로 줄며 팝)
    const toEmoji = (word, emoji) => {
      if (swapped.some((e) => e.word === word)) return;                    // 이미 이모지 상태면 중복 치환 금지
      const els = findWord(word);
      if (!els) return;
      els.forEach((c) => { c.style.display = c.dataset.display || ''; c.textContent = c.dataset.ch; });   // 항상 원문 상태에서 출발
      const width = els.reduce((sum, c) => sum + c.getBoundingClientRect().width, 0);
      const first = els[0];
      const entry = { word, els, text: first.textContent };
      swapped.push(entry);
      els.slice(1).forEach((c) => { c.style.display = 'none'; });
      first.style.display = 'inline-block'; first.style.textAlign = 'center';
      first.textContent = emoji;
      const natural = first.getBoundingClientRect().width;
      gsap.fromTo(first, { width, scale: 0.4, rotation: -15 }, { width: natural, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.6)' });
    };
    // 이모지 → 단어 : 이모지가 작아져 사라진 뒤 한글 IME 로 치듯 자모 단위(TYPE_MS 간격)로 타이핑된다 (회사: ㅎ→호→회→횟→회사)
    // 진행은 전부 setTimeout(later) 기준 — GSAP 콜백(rAF)에 기대면 백그라운드 탭에서 멈춘 채 다음 사이클과 겹쳐 상태가 꼬인다
    const toText = (entry) => {
      if (entry.typing) return;
      const first = entry.els[0];
      const steps = typingSteps(entry.word);
      entry.typing = true;
      const render = (text) => {
        const chars = Array.from(text);
        entry.els.forEach((c, i) => { if (i < chars.length) { c.style.display = c.dataset.display || ''; c.textContent = chars[i]; } else c.style.display = 'none'; });
      };
      gsap.to(first, { scale: 0, duration: 0.18, ease: 'power2.in' });
      later(() => {
        gsap.killTweensOf(first); first.style.width = ''; first.style.textAlign = '';
        gsap.set(first, { clearProps: 'transform,width' });
        steps.forEach((text, k) => later(() => render(text), TYPE_MS * k));
        later(() => { render(entry.word); swapped = swapped.filter((e) => e !== entry); }, TYPE_MS * steps.length);
      }, 180);
    };
    // 사이클 : 이모지 넷을 2초 간격으로 → 2초 쉬고 → 랜덤 순서로 2초 간격 타이핑 복귀 → 2초 쉬고 → 반복. 시작 전에 남은 상태가 있으면 전부 원문으로 정리
    const cycle = () => {
      if (!heroVisible()) return;
      if (swapped.length) { swapped.forEach(putBack); swapped = []; }
      const order = gsap.utils.shuffle(WORDS.slice());
      order.forEach(([word, emoji], i) => later(() => heroVisible() && toEmoji(word, emoji), STEP_MS * i));
      const back = STEP_MS * order.length + STEP_MS;
      const backOrder = gsap.utils.shuffle(WORDS.map(([w]) => w));
      backOrder.forEach((word, i) => later(() => { const entry = swapped.find((e) => e.word === word); if (entry && heroVisible()) toText(entry); }, back + STEP_MS * i));
      later(cycle, back + STEP_MS * backOrder.length + STEP_MS);
    };
    // 탭이 숨겨지면(백그라운드) 즉시 원문으로 돌리고 모든 예약을 비운다. 다시 보이면 5초 유휴부터 다시 센다
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimers(); swapped.forEach(putBack); swapped = []; restoring = false; clearTimeout(idleTimer); } else arm(); });
    const arm = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (heroVisible() && heroChars.length) cycle(); }, IDLE_MS); };
    const activity = () => { if (!restoring && (swapped.length || timers.length)) typeBackAll(); arm(); };
    ['mousemove', 'mousedown', 'wheel'].forEach((ev) => window.addEventListener(ev, activity, { passive: true }));
    arm();
  }

  /* ---------- 우측 상단 고정 Early Access 버튼 문구 루프 : 노출 10초 후 「지금 무료」 가 타이핑되고, 2초 뒤 「Early Access」 가 한 글자씩 타이핑돼 돌아온다. 이후 10초마다 반복. 버튼이 숨겨지면 멈추고 원문으로 ---------- */
  if (fixedCta && !MOBILE) {
    const LABEL = 'Early Access', ALT = '지금 무료', ZW = '\u200b';   // 빈 문자열이면 줄 높이가 사라져 버튼이 납작해지므로 폭 0 문자로 유지
    const CTA_GAP = 10000, CTA_HOLD = 2000, KO_MS = 90, EN_MS = 60;
    let ctaTimers = [], ctaHidden = null;
    const ctaLater = (fn, ms) => ctaTimers.push(setTimeout(fn, ms));
    const ctaClear = () => { ctaTimers.forEach(clearTimeout); ctaTimers = []; };
    // 문구를 바꾸고, 버튼 폭(hug)을 이전 폭에서 새 문구의 자연 폭으로 부드럽게 트윈 → 글자가 지워지며 줄었다가 타이핑되며 다시 커지는 모션
    const setLabel = (text) => {
      const prev = fixedCta.getBoundingClientRect().width;
      fixedCta.style.width = 'auto'; fixedCta.textContent = text;
      const next = fixedCta.offsetWidth;
      gsap.fromTo(fixedCta, { width: prev }, { width: next, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };
    const typeInto = (steps, ms) => { steps.forEach((t, i) => ctaLater(() => setLabel(t), ms * i)); return ms * steps.length; };
    const run = () => {
      setLabel(ZW);
      const ko = typeInto(typingSteps(ALT), KO_MS);
      const enSteps = Array.from(LABEL).map((_, i) => LABEL.slice(0, i + 1));
      ctaLater(() => { setLabel(ZW); typeInto(enSteps, EN_MS); }, ko + CTA_HOLD);
      const done = ko + CTA_HOLD + EN_MS * (enSteps.length + 1);
      ctaLater(() => gsap.set(fixedCta, { clearProps: 'width' }), done + 300);          // 원문으로 돌아오면 인라인 폭을 지워 다시 hug
      ctaLater(run, done + CTA_GAP);
    };
    const sync = () => {
      const hidden = fixedCta.classList.contains('is-hidden');
      if (hidden === ctaHidden) return;
      ctaHidden = hidden;
      ctaClear(); gsap.killTweensOf(fixedCta, 'width'); fixedCta.textContent = LABEL; gsap.set(fixedCta, { clearProps: 'width' });
      if (!hidden) ctaLater(run, CTA_GAP);
    };
    new MutationObserver(sync).observe(fixedCta, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  /* ---------- 진단 오버레이 (?dbg) : 실제 기기에서 타이틀 분할·스크롤 트리거 상태를 눈으로 확인하기 위한 임시 패널 ---------- */
  if (location.search.includes('dbg')) {
    const box = document.createElement('pre');
    Object.assign(box.style, { position: 'fixed', left: '4px', bottom: '4px', zIndex: '999', margin: '0', padding: '6px 8px', font: '10px/1.3 monospace', color: '#0f0', background: 'rgba(0,0,0,.75)', maxWidth: '96vw', whiteSpace: 'pre-wrap', pointerEvents: 'none' });
    document.body.appendChild(box);
    const tick = () => {
      const titles = gsap.utils.toArray('.split-lines').map((el, i) => {
        const chars = [...el.querySelectorAll(':scope > div > div > div')];
        const vis = chars.filter((c) => +getComputedStyle(c).opacity > 0.9).length;
        const st = ScrollTrigger.getAll().find((t) => t.trigger === el);
        const r = el.getBoundingClientRect();
        return `T${i} top:${Math.round(r.top)} masks:${el.querySelectorAll(':scope > div').length} chars:${vis}/${chars.length} op:${getComputedStyle(el).opacity} ${st ? `st:${Math.round(st.start)}/${st.progress.toFixed(2)}` : 'st:none'}`;
      });
      box.textContent = [`${navigator.userAgent.match(/(CriOS|Version|Chrome|Safari)\/[\d.]+/g)?.join(' ') || ''} gsap:${gsap.version} split:${!!window.SplitText} reduce:${matchMedia('(prefers-reduced-motion: reduce)').matches} mob:${mobileMq.matches}`,
        `scrollY:${Math.round(scrollY)} vh:${innerHeight} docH:${document.documentElement.scrollHeight} fonts:${document.fonts ? document.fonts.status : '?'}`, ...titles].join('\n');
    };
    setInterval(tick, 400); tick();
  }

  /* ---------- Section 1 : 텍스트가 화면 가운데 오면 고정 → 스크롤에 따라 첫 줄부터 검정으로 → 모두 바뀌면 해제 ---------- */
  const s1Lines = gsap.utils.toArray('.s1__line');
  if (s1Lines.length) {
    const PIN_SCROLL = 900;                                   // 고정 상태로 소비하는 스크롤 길이(px)
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#s1', pin: true, start: 'top top',
        // anticipatePin 은 빠른 스크롤 시 start 보다 100px+ 먼저 고정해 텍스트가 가운데로 '튀어' 보인다 → 사용 안 함
        end: '+=' + PIN_SCROLL, scrub: true, invalidateOnRefresh: true
      }
    });
    tl.to({}, { duration: 0.15 });                           // 고정 직후 잠깐 멈춤
    s1Lines.forEach((line, i) => {
      tl.to(line, { '--t': 1, duration: 0.5, ease: 'none' }, 0.15 + i * 0.55);
    });
    tl.to({}, { duration: 0.15 });                           // 모두 검정이 된 뒤 잠깐 멈춤
  }

  /* ---------- Section 4 : 핀 + 3개 슬라이드 스토리 ----------
     슬라이드마다 [커버(중앙 타이틀)] → [타이틀 상단 이동 + 캡션/자세히 + 목업 등장] → 다음 슬라이드 크로스페이드 */
  const s4 = document.querySelector('.s4');
  const s4Slides = gsap.utils.toArray('.s4__slide');
  if (s4 && s4Slides.length) {
    // 데스크톱(835px+)에서만 스크롤 스토리. 창 크기가 모바일 폭으로 바뀌면 GSAP 이 핀/인라인 스타일을 되돌려 CSS 정적 레이아웃(카드 3장 전부 표시)만 남는다
    const s4mm = gsap.matchMedia();
    s4mm.add('(min-width: 835px)', () => {
    const SLIDE_SCROLL = 2000;                                 // 슬라이드당 스크롤 길이 (멈춤 구간 포함)
    const tl = gsap.timeline({
      scrollTrigger: { trigger: s4, pin: '.s4__sticky', start: 'top top', end: '+=' + (SLIDE_SCROLL * s4Slides.length), scrub: 0.4, invalidateOnRefresh: true } // anticipatePin 제거: 섹션1 과 같은 조기 스냅 방지
    });
    /* 슬라이드 i 구간 = [i, i+1] (1 = SLIDE_SCROLL px)
       0.00~0.12  이 슬라이드가 이전 슬라이드 위로 크로스페이드 인 (문장만 보이는 상태)
       0.12~0.36  ■ 한 문장 읽는 멈춤 (약 480px)
       0.36~0.52  문장 축소 + 타이틀 등장 (커버)
       0.52~0.60  ■ 커버 멈춤
       0.60~0.72  헤드 상단으로
       0.68~0.88  목업 상승, 캡션/자세히 등장
       0.88~1.00  ■ 콘텐츠 읽는 멈춤 (약 240px) 후 다음 슬라이드 */
    // 글자 크기를 고정하면서 좁은 폭에서는 헤드가 길어진다 → 헤드 높이를 --s4-head-h 로 넘겨 CSS 가 목업을 아래로 밀 수 있게 한다
    if (window.ResizeObserver) {
      const headRO = new ResizeObserver((entries) => { entries.forEach((e) => e.target.closest('.s4__slide').style.setProperty('--s4-head-h', Math.ceil(e.contentRect.height) + 'px')); });
      s4Slides.forEach((slide) => headRO.observe(slide.querySelector('.s4__head')));
    }
    // 슬라이드 표시 여부는 .is-active 클래스(CSS)가 아니라 타임라인 인라인 opacity 로만 결정한다 (클래스가 먼저 빠지며 생기는 깜빡임 방지)
    s4Slides.forEach((slide, k) => gsap.set(slide, { opacity: k === 0 ? 1 : 0 }));
    const s4TitleSplits = [];                                 // 타이틀 글자 분할 (모바일 전환 시 revert)
    s4Slides.forEach((slide, i) => {
      const t0 = i;
      const head = slide.querySelector('.s4__head');
      const eyebrow = slide.querySelector('.s4__eyebrow');
      const title = slide.querySelector('.s4__title');
      const mock = slide.querySelector('.s4__mock');
      const more = slide.querySelector('.s4__more');
      const cap = slide.querySelector('.s4__caption');
      if (i > 0) {
        // 이전 슬라이드를 먼저 0 으로 빼면 둘 다 투명한 순간 카드 흰 배경이 비쳐 깜빡인다 → 이전 슬라이드는 그대로 두고 새 슬라이드(DOM 상 위)를 위에 페이드 인한 뒤, 완전히 덮인 다음에야 이전 슬라이드를 끈다
        tl.fromTo(slide, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none' }, t0);
        tl.set(s4Slides[i - 1], { opacity: 0 }, t0 + 0.12);
      }
      // --hy / --m 은 단위 없는 값. CSS 에서 반응형 스케일(--u)을 곱해 실제 px 로 쓴다
      gsap.set(head, { '--hy': 374 });
      gsap.set(eyebrow, { '--m': 1 });
      tl.to(eyebrow, { '--m': 0, fontWeight: 500, lineHeight: 1.63, letterSpacing: '-0.48px', duration: 0.16, ease: 'power2.inOut' }, t0 + 0.36);
      tl.fromTo(head, { '--hy': 374 }, { '--hy': 271, duration: 0.16, ease: 'power2.inOut' }, t0 + 0.36);
      if (window.SplitText) {
        // 다른 섹션 타이틀처럼 줄 마스크 + 글자 단위 슬라이드 업. 스크럽 타임라인이라 duration/stagger 는 스크롤 거리(1 = SLIDE_SCROLL px) 단위
        const split = SplitText.create(title, { type: 'lines,chars', mask: 'lines' });
        s4TitleSplits.push(split);
        gsap.set(title, { opacity: 1 });
        tl.from(split.chars, { yPercent: 100, opacity: 0, duration: 0.12, ease: 'power2.out', stagger: 0.004 }, t0 + 0.42);
      } else {
        tl.fromTo(title, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.14, ease: 'power2.out' }, t0 + 0.42);
      }
      tl.fromTo(head, { '--hy': 271 }, { '--hy': 37, duration: 0.12, ease: 'power2.inOut', immediateRender: false }, t0 + 0.6);
      tl.fromTo(mock, { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' }, t0 + 0.68);
      if (cap) tl.to(cap, { opacity: 1, duration: 0.08, ease: 'none' }, t0 + 0.74);
      tl.to(more, { opacity: 1, duration: 0.08, ease: 'none' }, t0 + 0.78);
      tl.to({}, { duration: 0.12 }, t0 + 0.88);                 // 콘텐츠 멈춤 (타임라인 길이 확보)
    });
    // 역방향으로 되돌아올 때 활성 클래스 정리
    tl.eventCallback('onUpdate', () => {
      const idx = Math.min(s4Slides.length - 1, Math.floor(tl.progress() * s4Slides.length));
      s4Slides.forEach((s, k) => s.classList.toggle('is-active', k === idx));
    });
    // 데스크톱→모바일(834 이하)로 창이 줄면 GSAP 이 컨텍스트를 되돌리는데, .to() 트윈은 시작값(데스크톱 CSS opacity 0)을 인라인으로 남긴다
    // → 캡션/자세히 버튼이 모바일에서 안 보임. 되돌릴 때 인라인 스타일을 지워 CSS 정적 레이아웃만 남긴다 (슬라이드의 --bg 인라인은 유지)
    return () => {
      s4TitleSplits.forEach((sp) => sp.revert());
      gsap.set(s4Slides, { clearProps: 'opacity' });
      gsap.set(s4.querySelectorAll('.s4__head, .s4__eyebrow, .s4__title, .s4__mock, .s4__more, .s4__caption'), { clearProps: 'all' });
    };
    }); // s4mm

    /* 상세 모달 */
    const modal = document.getElementById('s4-modal');
    const backdrop = document.getElementById('s4-backdrop');
    const closeBtn = document.querySelector('.s4__close');
    const bodies = modal ? Array.from(modal.querySelectorAll('.s4__modal-body')) : [];
    // 모달이 열린 동안 페이지 스크롤 잠금 (스크롤은 모달 안에서만), 바깥 클릭/ESC/X 로 닫힘 (0.2s)
    let lockedY = 0;
    // body 를 position:fixed 로 바꾸면 scrollY 가 0 이 되어 ScrollTrigger 가 전부 되감긴다(핀 해제·GNB 흰색).
    // 대신 html overflow:hidden 으로 잠그고 스크롤 위치는 그대로 둔다.
    const lockPage = () => { lockedY = window.scrollY; document.documentElement.classList.add('is-locked'); };
    const unlockPage = () => { document.documentElement.classList.remove('is-locked'); if (Math.abs(window.scrollY - lockedY) > 1) window.scrollTo(0, lockedY); };
    const openModal = (idx) => {
      bodies.forEach((b) => { b.hidden = String(idx) !== b.dataset.modalBody; });
      (modal.querySelector('.s4__modal-scroll') || modal).scrollTop = 0;
      modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
      lockPage();
      gsap.fromTo(modal, { y: 24, scale: 0.98, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
      if (backdrop) gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' });
      if (closeBtn) { closeBtn.hidden = false; gsap.fromTo(closeBtn, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' }); }
    };
    const closeModal = () => {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
      unlockPage();
      gsap.to(modal, { y: 16, scale: 0.98, autoAlpha: 0, duration: 0.2, ease: 'power2.in' });
      if (backdrop) gsap.to(backdrop, { autoAlpha: 0, duration: 0.2, ease: 'power2.in' });
      if (closeBtn) gsap.to(closeBtn, { autoAlpha: 0, duration: 0.2, ease: 'power2.in', onComplete: () => { closeBtn.hidden = true; } });
    };
    document.querySelectorAll('.s4__more').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); openModal(btn.dataset.modal); }));
    if (modal) {
      if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeModal(); });
      modal.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', () => closeModal());                 // 모달 바깥 클릭
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
      // 잠금 상태에서 휠/터치가 페이지로 새지 않게 (모달 밖에서 발생한 것만 차단)
      const block = (e) => { if (modal.classList.contains('is-open') && !modal.contains(e.target)) e.preventDefault(); };
      window.addEventListener('wheel', block, { passive: false });
      window.addEventListener('touchmove', block, { passive: false });
      const SCROLL_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
      window.addEventListener('keydown', (e) => { if (modal.classList.contains('is-open') && SCROLL_KEYS.includes(e.key) && !modal.contains(e.target)) e.preventDefault(); });
    }
  }

  /* ---------- Early Access 풀 모달 (Figma 72:4525) : 버튼 3개가 열고, X·ESC·바깥(16px 여백) 클릭으로 닫힘. 페이지 스크롤은 잠그고 모달 안에서만 스크롤 ---------- */
  const eaModal = document.getElementById('ea-modal');
  if (eaModal) {
    let eaLockedY = 0;
    const eaOpen = () => {
      if (eaModal.classList.contains('is-open')) return;
      eaLockedY = window.scrollY; document.documentElement.classList.add('is-locked');
      eaModal.classList.add('is-open'); eaModal.setAttribute('aria-hidden', 'false');
      eaModal.querySelector('.ea-modal__scroll').scrollTop = 0;
      if (fixedCta) fixedCta.classList.add('is-modal');
      gsap.fromTo(eaModal, { y: 24, scale: 0.985, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.45, ease: 'power3.out' });
      eaModal.querySelector('.ea-modal__close').focus({ preventScroll: true });
    };
    const eaClose = () => {
      if (!eaModal.classList.contains('is-open')) return;
      eaModal.classList.remove('is-open'); eaModal.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('is-locked'); if (Math.abs(window.scrollY - eaLockedY) > 1) window.scrollTo(0, eaLockedY);
      if (fixedCta) fixedCta.classList.remove('is-modal');
      gsap.to(eaModal, { y: 16, scale: 0.985, autoAlpha: 0, duration: 0.2, ease: 'power2.in' });
    };
    window.eaModalClose = eaClose;
    document.querySelectorAll('a.cta[href="early-access/"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); eaOpen(); }));
    eaModal.querySelector('.ea-modal__close').addEventListener('click', eaClose);
    eaModal.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => { if (eaModal.classList.contains('is-open') && !document.getElementById('gnb').contains(e.target)) eaClose(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') eaClose(); });
    const eaBlock = (e) => { if (eaModal.classList.contains('is-open') && !eaModal.contains(e.target)) e.preventDefault(); };
    window.addEventListener('wheel', eaBlock, { passive: false });
    window.addEventListener('touchmove', eaBlock, { passive: false });
    const EA_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
    window.addEventListener('keydown', (e) => { if (eaModal.classList.contains('is-open') && EA_KEYS.includes(e.key) && !eaModal.contains(e.target)) e.preventDefault(); });
  }

  /* ---------- Section 5 : 카드 등장 + 패럴랙스 ---------- */
  const s5 = document.getElementById('s5');
  const s5Cards = gsap.utils.toArray('.s5__card');
  if (s5 && s5Cards.length) {
    // 배경 큰 원: 섹션이 지나가는 동안 스크롤에 비례해 커짐
    gsap.fromTo('.s5__ellipse', { scale: 0.55 }, { scale: 1.15, ease: 'none',
      scrollTrigger: { trigger: s5, start: 'top bottom', end: 'bottom top', scrub: true } });
    // 가운데 문장: 뷰포트 아래쪽(85%)에 들어오면 한 글자씩 순서대로 드러난다
    const cap = s5.querySelector('.s5__caption');
    if (cap && !cap.querySelector('.s5__ch')) {
      // <br class="br-m"> 기준으로 줄을 나눠(모바일 2줄, Figma 30:2650) 줄마다 .s5__line(nowrap) 안에 글자 span 을 넣는다 → 글자 단위 inline-block 이 임의 위치에서 줄바꿈되지 않음
      const lines = [[]];
      cap.childNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') lines.push([]);
        else if (node.nodeType === Node.TEXT_NODE) lines[lines.length - 1].push(node.textContent.trim());
      });
      const lineTexts = lines.map((parts) => parts.join(''));
      cap.setAttribute('aria-label', lineTexts.join(' '));
      cap.innerHTML = lineTexts.map((line) => `<span class="s5__line">${Array.from(line).map((ch) => `<span class="s5__ch" aria-hidden="true">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</span>`).join('<br class="br-m" />');
      gsap.from(cap.querySelectorAll('.s5__ch'), { opacity: 0, y: 14, filter: 'blur(4px)', duration: 0.5, ease: EASE, stagger: 0.045,
        scrollTrigger: { trigger: cap, start: 'top 85%', toggleActions: 'play none none reverse' } });
    }
    s5Cards.forEach((card) => {
      const depth = parseFloat(card.dataset.depth || '1');
      gsap.fromTo(card, { opacity: 0, yPercent: 12, scale: 0.96 },
        { opacity: 1, yPercent: 0, scale: 1, duration: 1.1, ease: EASE,
          scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none reverse' } });
      const amp = MOBILE ? 40 : 120;                                      // 모바일은 프레임이 작아 진폭 축소
      gsap.fromTo(card, { y: amp * depth }, { y: -amp * depth, ease: 'none',
        scrollTrigger: { trigger: s5, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* 섹션 6/7/9 화면 이미지: export 가 비주얼 박스 하단에 맞춰 클립된 상태라 세로 패럴랙스를 주면 아래가 떠 보인다 → 패럴랙스 없음 */

  /* ---------- 푸터 메시지 ---------- */
  gsap.from('.footer__msg > *', { y: 30, opacity: 0, duration: 1, ease: EASE, stagger: 0.12,
    scrollTrigger: { trigger: '.footer__msg', start: 'top 85%', toggleActions: 'play none none reverse' } });

  /* 트리거는 문서 순서대로 만들어지지 않았다(타이틀·reveal 이 섹션 1·4 의 pin 보다 먼저 생성). refresh 는 생성 순서로 위치를 계산하므로
     pin 이 늘리는 스크롤 길이(섹션 1 900px, 섹션 4 6000px)가 뒤쪽 트리거의 start 에 반영되지 않아 타이틀 모션이 화면에 들어오기 한참 전에 재생돼 버렸다
     → 시작 위치 순으로 정렬한 뒤 다시 계산 (ScrollTrigger.sort) */
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  window.addEventListener('load', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
  /* 창 크기 변경 보정: window resize 이벤트를 놓치는 경우(다른 탭에서 리사이즈, 디스플레이 이동 등)에도
     뷰포트 크기가 바뀌었으면 핀 레이아웃을 다시 계산한다 */
  let vw = innerWidth, vh = innerHeight, refreshTimer;
  const refreshIfResized = () => {
    if (innerWidth === vw && innerHeight === vh) return;
    vw = innerWidth; vh = innerHeight;
    clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
  };
  if (window.ResizeObserver) new ResizeObserver(refreshIfResized).observe(document.documentElement);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfResized(); });
  window.addEventListener('pageshow', refreshIfResized);
})();
