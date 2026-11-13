// node --test _notice/*.test.mjs — 공고 화면 그리기 (PW-2255 · 정책 screen-homepage-notice.policy.md · 11-11 새 디자인 notice.js)
// 이 파일이 깨지면 notice-sync 예약 작업이 첫 단계에서 멈춰 운영 공고 사본이 안 올라간다(.github/workflows/notice-sync.yml).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const N = createRequire(import.meta.url)('../notice/notice.js');

const OPEN = '2999-12-31', ENDED = '2000-01-01';
const item = (no, over = {}) => ({ no, category: 'general', title: `공고 ${no}`, publishedAt: `2027-05-${String(no).padStart(2, '0')}T01:00:00.000Z`, periodEndsOn: OPEN, isCorrection: false, isCorrected: false, ...over });

test('0건이면 빈 상태 문구(정책 §4)', () => {
  const h = N.listHtml([], 1);
  assert.match(h, /아직 게시한 공고가 없습니다\./);
  assert.match(h, /공고가 생기면 이 페이지에 싣습니다\./);
});

test('목록 행은 공고 하나의 주소 /notice/<번호>/ 로 간다 — ?no= 주소에는 그 공고의 링크 미리보기가 없다(PW-2344)', () => {
  const h = N.listHtml([item(26), item(3)], 1);
  assert.match(h, /<a class="notice__row" href="\/notice\/26\/">/);
  assert.match(h, /<a class="notice__row" href="\/notice\/3\/">/);
  assert.doesNotMatch(h, /\?no=/);
  assert.equal(N.detailHref(7), '/notice/7/');
});

test('행 — 제N호 · 분류 · 정정 · 정정됨 · 게시일(KST) · 공고기간 종료', () => {
  const h = N.listHtml([item(1, { isCorrected: true, periodEndsOn: ENDED }), item(2, { isCorrection: true, category: 'settlement' })], 1);
  assert.match(h, /제1호.*일반공고.*공고 1.*정정됨.*2027\.05\.01.*공고기간 종료/s);
  assert.match(h, /제2호.*결산공고.*정정.*공고 2/s);
  assert.doesNotMatch(h.split('제1호')[0], /공고기간 종료/);
});

test('게시 시각 내림차순 · 같은 초면 번호 큰 것이 위(정책 §8 E10)', () => {
  const same = '2027-05-01T01:00:00.000Z';
  assert.deepEqual(N.sortItems([item(3, { publishedAt: same }), item(4, { publishedAt: same }), item(9)]).map((i) => i.no), [9, 4, 3]);
});

test('10건 넘으면 페이지 이동', () => {
  const items = Array.from({ length: 23 }, (_, i) => item(i + 1));
  assert.match(N.listHtml(items, 1), /aria-label="페이지"/);
  assert.doesNotMatch(N.listHtml(items.slice(0, 10), 1), /aria-label="페이지"/);
  assert.equal((N.listHtml(items, 3).match(/class="notice__row"/g) || []).length, 3);
});

test('본문 — 정정 관계 링크도 /notice/<번호>/ · 목록 버튼 · 글자 그대로', () => {
  const d = { no: 1, category: 'general', title: '<b>제목</b>', body: '첫 줄\nhttps://pivit.work <script>', publishedAt: '2027-01-05T01:00:00.000Z', periodEndsOn: ENDED, correctedBy: [{ no: 2 }, { no: 4 }] };
  const h = N.detailHtml(d, '/notice/?page=2');
  assert.match(h, /2027-01-05 10:00 \(KST\)/);
  assert.match(h, /이 공고는 정정되었습니다 — 정정 공고 <a href="\/notice\/2\/">제2호<\/a> · <a href="\/notice\/4\/">제4호<\/a>/);
  assert.match(h, /href="\/notice\/\?page=2">목록/);
  assert.match(h, /&lt;b&gt;제목&lt;\/b&gt;/);
  assert.match(h, /첫 줄\nhttps:\/\/pivit\.work &lt;script&gt;/);
  const c = N.detailHtml({ ...d, no: 2, correctedBy: undefined, corrects: { no: 1 }, attachment: { name: '제1기.pdf', size: 186000, url: '/notice/files/2/x.pdf' } }, '/notice/');
  assert.match(c, /<a href="\/notice\/1\/">제1호<\/a> 공고를 정정합니다\./);
  assert.match(c, /제1기\.pdf <span class="sz">PDF · 182KB/);
  assert.doesNotMatch(h + c, /\?no=/);
});

test('주소 → 화면 — 새 주소 /notice/<번호>/ 와 옛 링크 ?no=N 둘 다 본문', () => {
  assert.deepEqual(N.route('/notice/', ''), { view: 'list', page: null });
  assert.deepEqual(N.route('/notice/', '?page=2'), { view: 'list', page: '2' });
  assert.deepEqual(N.route('/notice/12/', ''), { view: 'detail', no: 12 });
  assert.deepEqual(N.route('/notice/', '?no=26'), { view: 'detail', no: 26 });
  assert.deepEqual(N.route('/notice/', '?no=0'), { view: 'list', page: null });
  assert.equal(N.TIMEOUT_MS, 10000);
});
