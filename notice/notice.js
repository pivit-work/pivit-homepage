/*
 * 공고 화면 — 목록 /notice · 본문 /notice/<번호> (PW-2255 · pivit-specs 7. Homepage/screen-homepage-notice.policy.md v1.0).
 *
 * 이 화면은 앱(app.pivit.work)을 부르지 않는다. 같은 사이트의 사본(notice/data/*.json · notice/files/*)만 읽는다 —
 * 사본은 _notice/sync.mjs 가 5분마다 앱 공개 API 에서 옮겨 온다. 앱이 멈춘 시간이 곧 공고 «중단»이 되지 않게 하려는 것이다.
 *
 * 아래 순수 함수들은 _notice/notice.test.mjs 가 node 로 직접 부른다.
 */
(function (root) {
  'use strict';

  var PAGE_SIZE = 20;
  var TIMEOUT_MS = 10000;
  var CAT = { settlement: '결산공고', general: '일반 공고' };
  var T = {
    title: '공고',
    desc: '주식회사 피빗이 상법과 정관에 따라 싣는 공고입니다.',
    empty: '아직 게시한 공고가 없습니다.',
    emptyHint: '공고가 생기면 이 페이지에 싣습니다.',
    missing: '찾는 공고가 없습니다.',
    toList: '공고 목록으로',
    back: '← 공고 목록',
    fail: '공고를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주십시오.',
    retry: '다시 시도',
    ended: '· 공고기간 종료',
    fileFail: '파일을 열지 못했습니다. 잠시 뒤 다시 시도해 주십시오.',
    download: '내려받기',
    pageMissing: '페이지를 찾을 수 없습니다.',
    home: '첫 화면으로',
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** UTC ISO → 한국 시각 'YYYY-MM-DD HH:mm'. 한국은 서머타임이 없어 +9 고정. */
  function kst(iso) {
    var d = new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString();
    return d.slice(0, 10) + ' ' + d.slice(11, 16);
  }

  function todayKst(now) {
    return new Date((now || new Date()).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  /** 종료일이 오늘(KST)보다 앞이면 끝났다 — 종료일 당일까지는 공고기간이다. */
  function isEnded(periodEndsOn, now) {
    return periodEndsOn < todayKst(now);
  }

  /** 게시 시각 내림차순 · 같은 초면 번호 큰 것이 위(정책 §8 E10). 사본이 이미 이 순서지만 화면이 다시 지킨다. */
  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
      return b.no - a.no;
    });
  }

  /** ?page= 해석 — 숫자가 아니거나 범위 밖이면 1페이지로 바꾸고 주소도 고친다(정책 §4). */
  function resolvePage(raw, total) {
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (raw === null || raw === undefined) return { page: 1, pages: pages, rewrite: false };
    var n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!(n >= 1 && n <= pages)) return { page: 1, pages: pages, rewrite: true };
    return { page: n, pages: pages, rewrite: false };
  }

  function fileSize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + 'MB';
    return Math.max(1, Math.round(bytes / 1024)) + 'KB';
  }

  function head() {
    return '<div class="nt-head"><h1 class="nt-title">' + T.title + '</h1><p class="nt-desc">' + T.desc + '</p></div>';
  }

  function rowHtml(n, now) {
    return (
      '<a class="nt-row" href="/notice/' + n.no + '/">' +
      '<span class="nt-no">제' + n.no + '호</span>' +
      '<span class="nt-body"><span class="nt-row-head">' +
      '<span class="tag">' + esc(CAT[n.category] || '') + '</span>' +
      (n.isCorrection ? '<span class="tag fix">정정</span>' : '') +
      '<span class="nt-row-title">' + esc(n.title) + '</span>' +
      (n.isCorrected ? '<span class="tag fix">정정됨</span>' : '') +
      '</span><span class="nt-meta">게시일 ' + kst(n.publishedAt).slice(0, 10) +
      (isEnded(n.periodEndsOn, now) ? '<span class="end">' + T.ended + '</span>' : '') +
      '</span></span></a>'
    );
  }

  function listHtml(items, page, now) {
    if (items.length === 0)
      return head() + '<div class="nt-empty"><b>' + T.empty + '</b><span>' + T.emptyHint + '</span></div>';
    var sorted = sortItems(items);
    var pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    var shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    var h = head() + '<div class="nt-list">' + shown.map(function (n) { return rowHtml(n, now); }).join('') + '</div>';
    if (pages > 1) {
      h += '<nav class="nt-pager" aria-label="페이지"><button type="button" data-pg="' + (page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>이전</button>';
      for (var i = 1; i <= pages; i++)
        h += '<button type="button" data-pg="' + i + '"' + (i === page ? ' aria-current="page"' : '') + '>' + i + '</button>';
      h += '<button type="button" data-pg="' + (page + 1) + '"' + (page === pages ? ' disabled' : '') + '>다음</button></nav>';
    }
    return h;
  }

  function noLink(no) {
    return '<a href="/notice/' + no + '/">제' + no + '호</a>';
  }

  function detailHtml(n, backHref, now) {
    var fix = [];
    if (n.corrects) fix.push('<span>' + noLink(n.corrects.no) + ' 공고를 정정합니다.</span>');
    if (n.correctedBy && n.correctedBy.length)
      fix.push('<span>이 공고는 정정되었습니다 — 정정 공고 ' + n.correctedBy.map(function (c) { return noLink(c.no); }).join(' · ') + '</span>');
    var back = '<a class="nt-back" href="' + backHref + '">' + T.back + '</a>';
    return (
      back +
      (fix.length ? '<div class="nt-fix">' + fix.join('') + '</div>' : '') +
      '<div class="nt-doc-head"><div class="nt-doc-tags">제' + n.no + '호 <span class="tag">' + esc(CAT[n.category] || '') + '</span>' +
      (n.corrects ? '<span class="tag fix">정정</span>' : '') + '</div>' +
      '<h1 class="nt-doc-title">' + esc(n.title) + '</h1>' +
      '<div class="nt-doc-info"><span>게시 일시 ' + kst(n.publishedAt) + ' (KST)</span><span>공고기간 ' +
      kst(n.publishedAt).slice(0, 10) + ' ~ ' + esc(n.periodEndsOn) +
      (isEnded(n.periodEndsOn, now) ? ' <span class="end">' + T.ended + '</span>' : '') + '</span></div></div>' +
      // 본문은 글자 그대로 — 줄바꿈은 CSS(pre-wrap)가 지키고 링크로 바꾸지 않는다(기획서 §2-C).
      '<div class="nt-doc-body">' + esc(n.body) + '</div>' +
      (n.attachment
        ? '<div class="nt-file"><span class="nm">' + esc(n.attachment.name) + ' <span class="sz">PDF · ' + fileSize(n.attachment.size) +
          '</span><span class="err" hidden>' + T.fileFail + '</span></span><a class="btn btn-md btn-ghost" href="' + esc(n.attachment.url) +
          '" target="_blank" rel="noopener">' + T.download + '</a></div>'
        : '') +
      '<div class="nt-doc-foot">' + back + '</div>'
    );
  }

  function missingHtml() {
    return '<a class="nt-back" href="/notice/">' + T.back + '</a><div class="nt-empty" style="margin-top:20px"><b>' + T.missing +
      '</b><a class="btn btn-md btn-ghost" href="/notice/">' + T.toList + '</a></div>';
  }

  function failHtml(withBack) {
    return (withBack ? '<a class="nt-back" href="/notice/">' + T.back + '</a>' : head()) +
      '<div class="nt-empty"' + (withBack ? ' style="margin-top:20px"' : '') + '><b>' + T.fail + '</b><button type="button" class="btn btn-md btn-ghost" data-retry>' + T.retry + '</button></div>';
  }

  function loadingHtml(isDetail) {
    var sk = '<div class="nt-list"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>';
    return isDetail ? '<a class="nt-back" href="/notice/">' + T.back + '</a><div style="margin-top:24px">' + sk + '</div>' : head() + sk;
  }

  /** 주소 → 화면. '/notice' 목록, '/notice/3' 본문, 그 밖의 '/notice/…' 없는 공고, 공고 밖 주소는 사이트 404. */
  function route(pathname) {
    if (/^\/notice\/?$/.test(pathname)) return { view: 'list' };
    var m = /^\/notice\/([1-9]\d{0,8})\/?$/.exec(pathname);
    if (m) return { view: 'detail', no: Number(m[1]) };
    if (/^\/notice(\/|$)/.test(pathname)) return { view: 'missing' };
    return { view: 'site404' };
  }

  var api = {
    PAGE_SIZE: PAGE_SIZE, T: T, esc: esc, kst: kst, isEnded: isEnded, sortItems: sortItems, resolvePage: resolvePage,
    fileSize: fileSize, failHtml: failHtml, TIMEOUT_MS: TIMEOUT_MS, listHtml: listHtml, detailHtml: detailHtml, missingHtml: missingHtml, route: route,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  // ── 브라우저 ──
  var view = document.getElementById('view');
  var listCache = null;

  function getJson(url) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
    return fetch(url, { signal: ctl.signal, cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res.status === 404) return { missing: true };
      if (!res.ok) throw new Error(String(res.status));
      return res.json().then(function (body) { return { body: body }; });
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function renderList() {
    var params = new URLSearchParams(location.search);
    var p = resolvePage(params.get('page'), listCache.length);
    if (p.rewrite) history.replaceState(null, '', '/notice/?page=1');
    try { sessionStorage.setItem('notice.listPage', String(p.page)); } catch (e) { /* 저장 안 되는 브라우저 */ }
    view.innerHTML = listHtml(listCache, p.page);
  }

  function loadList() {
    view.innerHTML = loadingHtml(false);
    getJson('/notice/data/list.json').then(function (r) {
      if (r.missing) throw new Error('404');
      listCache = r.body.items || [];
      renderList();
    }).catch(function () { view.innerHTML = failHtml(false); });
  }

  function backHref() {
    var page = null;
    try { page = sessionStorage.getItem('notice.listPage'); } catch (e) { /* 없음 */ }
    return page && page !== '1' ? '/notice/?page=' + page : '/notice/';
  }

  function loadDetail(no) {
    view.innerHTML = loadingHtml(true);
    getJson('/notice/data/' + no + '.json').then(function (r) {
      if (r.missing) { view.innerHTML = missingHtml(); return; }
      document.title = '제' + r.body.no + '호 ' + r.body.title + ' — 공고 — Pivit';
      view.innerHTML = detailHtml(r.body, backHref());
      // 첨부를 못 받으면 본문은 두고 첨부 줄에만 알린다(정책 §8 E7).
      if (r.body.attachment)
        fetch(r.body.attachment.url, { method: 'HEAD', cache: 'no-cache' }).then(function (res) {
          if (!res.ok) throw new Error(String(res.status));
        }).catch(function () {
          var err = view.querySelector('.nt-file .err');
          if (err) err.hidden = false;
        });
    }).catch(function () { view.innerHTML = failHtml(true); });
  }

  function start() {
    var r = route(location.pathname);
    if (r.view === 'list') return loadList();
    if (r.view === 'detail') return loadDetail(r.no);
    if (r.view === 'missing') { view.innerHTML = missingHtml(); return; }
    view.innerHTML = '<div class="nt-empty nt-404"><b>' + T.pageMissing + '</b><a class="btn btn-md btn-ghost home" href="/">' + T.home + '</a></div>';
  }

  document.addEventListener('click', function (e) {
    var pg = e.target.closest('[data-pg]');
    if (pg && !pg.disabled && listCache) {
      history.pushState(null, '', '/notice/?page=' + pg.getAttribute('data-pg'));
      renderList();
      window.scrollTo(0, 0);
      return;
    }
    if (e.target.closest('[data-retry]')) start();
  });
  window.addEventListener('popstate', function () { if (route(location.pathname).view === 'list' && listCache) renderList(); else start(); });
  start();
})(this);
