/* 공고 게시판 — 목록(/notice/) · 상세(/notice/?no=N, 또는 /notice/N/ 경로). Figma 71:3603 / 71:4038.
   데이터는 같은 폴더의 data/list.json · data/<번호>.json (운영 사이트는 _notice/sync.mjs 가 앱 공개 API 에서 5분마다 옮겨 온 사본, 이 저장소에는 2026-11-10 스냅샷).
   표시 규칙은 preview.pivit.work/notice 의 notice.js 를 따른다: 게시 시각 내림차순, 10개씩, 종료일 다음 날부터 「공고기간 종료」, 본문은 글자 그대로(링크 변환 없음). */
(() => {
  const PAGE_SIZE = 10, TIMEOUT_MS = 10000;   // 한 페이지 10건 (사용자 지정)
  const CAT = { settlement: '결산공고', general: '일반공고' };
  const T = { empty: '아직 게시한 공고가 없습니다.', emptyHint: '공고가 생기면 이 페이지에 싣습니다.', missing: '찾는 공고가 없습니다.', toList: '공고 목록으로', back: '목록',
    fail: '공고를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주십시오.', retry: '다시 시도', ended: '공고기간 종료', download: '내려받기', fileFail: '파일을 열지 못했습니다. 잠시 뒤 다시 시도해 주십시오.' };
  const view = document.getElementById('view');
  const title = view.querySelector('.legal__title');
  const desc = view.querySelector('.notice__desc');
  const body = view.querySelector('.notice__body');
  const DATA = new URL('data/', location.href).pathname;                 // /notice/data/
  const LIST_URL = new URL('./', location.href).pathname;                 // /notice/

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kst = (iso) => { const d = new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString(); return { date: d.slice(0, 10), time: d.slice(11, 16) }; };
  const dot = (ymd) => ymd.replace(/-/g, '.');
  const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const isEnded = (endsOn) => endsOn < todayKst();
  const sortItems = (items) => items.slice().sort((a, b) => (a.publishedAt !== b.publishedAt ? (a.publishedAt < b.publishedAt ? 1 : -1) : b.no - a.no));
  const fileSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace(/\.0$/, '') + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB');
  const detailHref = (no) => `${LIST_URL}?no=${no}`;

  const badge = (text, mod) => `<span class="badge${mod ? ' badge--' + mod : ''}">${esc(text)}</span>`;
  const rowHtml = (n) => `<a class="notice__row" href="${detailHref(n.no)}">
    <span class="notice__no">제${n.no}호</span>
    <span class="notice__main">
      <span class="notice__head">${badge(CAT[n.category] || '')}${n.isCorrection ? badge('정정', 'fix') : ''}<span class="notice__title">${esc(n.title)}</span>${n.isCorrected ? badge('정정됨', 'fixed') : ''}</span>
      <span class="notice__meta"><span>${dot(kst(n.publishedAt).date)}</span>${isEnded(n.periodEndsOn) ? `<span>•</span><span class="is-ended">${T.ended}</span>` : ''}</span>
    </span></a>`;

  // 페이지 번호 : 1 … 현재±1 … 마지막 (Figma: 1 2 3 … 8 9 10)
  const pageNums = (page, pages) => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const set = new Set([1, 2, 3, pages - 2, pages - 1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
    const nums = [...set].sort((a, b) => a - b); const out = [];
    nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
    return out;
  };
  const pagerHtml = (page, pages) => pages <= 1 ? '' : `<nav class="notice__pager" aria-label="페이지">
    <button type="button" class="notice__pg-nav" data-pg="${page - 1}"${page === 1 ? ' disabled' : ''}>이전</button>
    <div class="notice__pager-nums">${pageNums(page, pages).map((n) => n === '…' ? '<span class="notice__pg-gap">...</span>' : `<button type="button" class="notice__pg-num" data-pg="${n}"${n === page ? ' aria-current="page"' : ''}>${n}</button>`).join('')}</div>
    <button type="button" class="notice__pg-nav" data-pg="${page + 1}"${page === pages ? ' disabled' : ''}>다음</button></nav>`;

  const listHtml = (items, page) => {
    if (!items.length) return `<div class="notice__empty"><b>${T.empty}</b><span>${T.emptyHint}</span></div>`;
    const sorted = sortItems(items), pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return `<div class="notice__list">${shown.map(rowHtml).join('')}</div>${pagerHtml(page, pages)}`;
  };

  const noLink = (no) => `<a href="${detailHref(no)}">제${no}호</a>`;
  const detailHtml = (n, backHref) => {
    const p = kst(n.publishedAt), ended = isEnded(n.periodEndsOn);
    const fix = [];
    if (n.corrects) fix.push(`<span>${noLink(n.corrects.no)} 공고를 정정합니다.</span>`);
    if (n.correctedBy && n.correctedBy.length) fix.push(`<span>이 공고는 정정되었습니다 — 정정 공고 ${n.correctedBy.map((c) => noLink(c.no)).join(' · ')}</span>`);
    return `<div class="notice__doc-head">
      <h1 class="notice__doc-title">${esc(n.title)}</h1>
      <div class="notice__doc-info"><dl><dt>게시 일시</dt><dd>${p.date} ${p.time} (KST)</dd></dl><dl><dt>공고기간</dt><dd>${p.date} ~ ${esc(n.periodEndsOn)}</dd></dl>${ended ? `<span class="is-ended">${T.ended}</span>` : ''}</div>
    </div>
    <div class="notice__doc">
      <div class="notice__doc-card">${fix.length ? `<div class="notice__fix">${fix.join('')}</div>` : ''}<pre class="notice__doc-body">${esc(n.body || '')}</pre>${n.attachment ? `<div class="notice__file"><span class="nm">${esc(n.attachment.name)} <span class="sz">PDF · ${fileSize(n.attachment.size)}</span><span class="err" hidden> ${T.fileFail}</span></span><a href="${esc(n.attachment.url)}" target="_blank" rel="noopener">${T.download}</a></div>` : ''}</div>
      <a class="notice__back" href="${backHref}">${T.back}</a>
    </div>`;
  };
  const emptyBox = (msg, actionHtml) => `<div class="notice__empty"><b>${msg}</b>${actionHtml}</div>`;
  const loadingHtml = () => '<div class="notice__list"><div class="notice__sk"></div><div class="notice__sk"></div><div class="notice__sk"></div></div>';

  const getJson = (url) => {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    return fetch(url, { signal: ctl.signal, cache: 'no-cache' }).then((res) => { clearTimeout(timer); if (res.status === 404) return { missing: true }; if (!res.ok) throw new Error(String(res.status)); return res.json().then((b) => ({ body: b })); }, (e) => { clearTimeout(timer); throw e; });
  };

  // 라우팅 : ?no=N 또는 /notice/N/ 이면 상세, 아니면 목록 (?page=P)
  const route = () => {
    const q = new URLSearchParams(location.search);
    const m = /\/notice\/([1-9]\d{0,8})\/?$/.exec(location.pathname);
    const no = q.get('no') || (m && m[1]);
    return no && /^[1-9]\d{0,8}$/.test(no) ? { view: 'detail', no: Number(no) } : { view: 'list', page: q.get('page') };
  };
  let listCache = null;
  const resolvePage = (raw, total) => { const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); const n = raw && /^\d+$/.test(raw) ? Number(raw) : 1; return { page: n >= 1 && n <= pages ? n : 1, pages }; };
  const backHref = () => { let page = null; try { page = sessionStorage.getItem('notice.listPage'); } catch (e) { /* 저장 불가 */ } return page && page !== '1' ? `${LIST_URL}?page=${page}` : LIST_URL; };

  const renderList = () => {
    const { page } = resolvePage(new URLSearchParams(location.search).get('page'), listCache.length);
    try { sessionStorage.setItem('notice.listPage', String(page)); } catch (e) { /* 저장 불가 */ }
    title.hidden = false; desc.hidden = false; title.textContent = '공고'; document.title = '공고 — Pivit';
    body.innerHTML = listHtml(listCache, page);
  };
  const loadList = () => {
    title.hidden = false; desc.hidden = false; body.innerHTML = loadingHtml();
    getJson(`${DATA}list.json`).then((r) => { if (r.missing) throw new Error('404'); listCache = r.body.items || []; renderList(); })
      .catch(() => { body.innerHTML = emptyBox(T.fail, `<button type="button" class="notice__back" data-retry>${T.retry}</button>`); });
  };
  const loadDetail = (no) => {
    title.hidden = true; desc.hidden = true; body.innerHTML = loadingHtml();
    getJson(`${DATA}${no}.json`).then((r) => {
      if (r.missing) { body.innerHTML = emptyBox(T.missing, `<a class="notice__back" href="${LIST_URL}">${T.toList}</a>`); return; }
      document.title = `제${r.body.no}호 ${r.body.title} — 공고 — Pivit`;
      body.innerHTML = detailHtml(r.body, backHref());
      if (r.body.attachment) fetch(r.body.attachment.url, { method: 'HEAD', cache: 'no-cache' }).then((res) => { if (!res.ok) throw new Error(String(res.status)); }).catch(() => { const err = body.querySelector('.notice__file .err'); if (err) err.hidden = false; });
    }).catch(() => { body.innerHTML = emptyBox(T.fail, `<button type="button" class="notice__back" data-retry>${T.retry}</button>`); });
  };
  const start = () => { const r = route(); if (r.view === 'detail') loadDetail(r.no); else loadList(); };

  document.addEventListener('click', (e) => {
    const pg = e.target.closest('[data-pg]');
    if (pg && !pg.disabled && listCache) { history.pushState(null, '', `${LIST_URL}?page=${pg.dataset.pg}`); renderList(); window.scrollTo(0, 0); return; }
    if (e.target.closest('[data-retry]')) start();
  });
  window.addEventListener('popstate', () => { const r = route(); if (r.view === 'list' && listCache) renderList(); else start(); });
  start();
})();
