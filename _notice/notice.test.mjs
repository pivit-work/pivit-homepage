// node --test _notice/*.test.mjs — 공고 화면 그리기 (PW-2255 · 정책 screen-homepage-notice.policy.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const N = createRequire(import.meta.url)('../notice/notice.js');

const now = new Date('2027-07-15T03:00:00Z');
const item = (no, over = {}) => ({ no, category: 'general', title: `공고 ${no}`, publishedAt: `2027-05-${String(no).padStart(2, '0')}T01:00:00.000Z`, periodEndsOn: '2027-10-31', isCorrection: false, isCorrected: false, ...over });

test('0건이면 빈 상태 문구(정책 §4)', () => {
  const h = N.listHtml([], 1, now);
  assert.match(h, /아직 게시한 공고가 없습니다\./);
  assert.match(h, /공고가 생기면 이 페이지에 싣습니다\./);
  assert.match(h, /주식회사 피빗이 상법과 정관에 따라 싣는 공고입니다\./);
});

test('행 — 제N호 · 분류 · 정정 · 정정됨 · 게시일(KST) · 공고기간 종료', () => {
  const h = N.listHtml([item(1, { isCorrected: true, periodEndsOn: '2027-07-14' }), item(2, { isCorrection: true, category: 'settlement' })], 1, now);
  assert.match(h, /제1호.*일반 공고.*공고 1.*정정됨.*게시일 2027-05-01<span class="end">· 공고기간 종료/s);
  assert.match(h, /제2호.*결산공고.*정정<\/span><span class="nt-row-title">공고 2/s);
  assert.ok(h.indexOf('제2호') < h.indexOf('제1호'), '최신 게시가 위');
});

test('종료일 당일은 아직 공고기간이다 · KST 자정을 넘으면 종료', () => {
  assert.equal(N.isEnded('2027-07-15', new Date('2027-07-15T14:59:00Z')), false);
  assert.equal(N.isEnded('2027-07-15', new Date('2027-07-15T15:00:00Z')), true);
});

test('같은 초면 번호 큰 것이 위(정책 §8 E10)', () => {
  const same = '2027-05-01T01:00:00.000Z';
  assert.deepEqual(N.sortItems([item(3, { publishedAt: same }), item(4, { publishedAt: same })]).map((i) => i.no), [4, 3]);
});

test('20건 넘으면 페이지 이동 · 범위 밖 page 는 1페이지로 주소도 고침', () => {
  const items = Array.from({ length: 23 }, (_, i) => item(i + 1));
  assert.match(N.listHtml(items, 1, now), /aria-label="페이지"/);
  assert.doesNotMatch(N.listHtml(items.slice(0, 20), 1, now), /aria-label="페이지"/);
  assert.equal((N.listHtml(items, 2, now).match(/class="nt-row"/g) || []).length, 3);
  assert.deepEqual(N.resolvePage('99', 23), { page: 1, pages: 2, rewrite: true });
  assert.deepEqual(N.resolvePage('x', 23), { page: 1, pages: 2, rewrite: true });
  assert.deepEqual(N.resolvePage('2', 23), { page: 2, pages: 2, rewrite: false });
  assert.deepEqual(N.resolvePage(null, 23), { page: 1, pages: 2, rewrite: false });
});

test('본문 — 게시 일시 KST · 공고기간 · 정정 관계 양쪽 · 첨부 · 글자 그대로', () => {
  const d = { no: 1, category: 'general', title: '<b>제목</b>', body: '첫 줄\nhttps://pivit.work <script>', publishedAt: '2027-01-05T01:00:00.000Z', periodBasis: 'fixed_date', periodEndsOn: '2027-01-20', correctedBy: [{ no: 2 }, { no: 4 }] };
  const h = N.detailHtml(d, '/notice/?page=2', now);
  assert.match(h, /게시 일시 2027-01-05 10:00 \(KST\)/);
  assert.match(h, /공고기간 2027-01-05 ~ 2027-01-20 <span class="end">· 공고기간 종료/);
  assert.match(h, /이 공고는 정정되었습니다 — 정정 공고 <a href="\/notice\/2\/">제2호<\/a> · <a href="\/notice\/4\/">제4호<\/a>/);
  assert.match(h, /href="\/notice\/\?page=2">← 공고 목록/);
  assert.match(h, /&lt;b&gt;제목&lt;\/b&gt;/);
  assert.match(h, /첫 줄\nhttps:\/\/pivit\.work &lt;script&gt;/);
  assert.doesNotMatch(h, /<a href="https:\/\/pivit\.work/);
  const c = N.detailHtml({ ...d, no: 2, correctedBy: undefined, corrects: { no: 1 }, attachment: { name: '제1기.pdf', size: 186000, url: '/notice/files/2/x.pdf' } }, '/notice/', now);
  assert.match(c, /<a href="\/notice\/1\/">제1호<\/a> 공고를 정정합니다\./);
  assert.match(c, /제1기\.pdf <span class="sz">PDF · 182KB/);
  assert.match(c, /target="_blank"/);
  assert.match(c, /파일을 열지 못했습니다\. 잠시 뒤 다시 시도해 주십시오\./);
});

test('주소 → 화면', () => {
  assert.deepEqual(N.route('/notice'), { view: 'list' });
  assert.deepEqual(N.route('/notice/'), { view: 'list' });
  assert.deepEqual(N.route('/notice/12/'), { view: 'detail', no: 12 });
  assert.deepEqual(N.route('/notice/abc'), { view: 'missing' });
  assert.deepEqual(N.route('/notice/0'), { view: 'missing' });
  assert.deepEqual(N.route('/foo'), { view: 'site404' });
});

test('불러오기 실패 — 문구 · [다시 시도] · 본문은 [← 공고 목록] · 10초에 끊는다(정책 §4 · §6)', () => {
  assert.equal(N.TIMEOUT_MS, 10000);
  const list = N.failHtml(false);
  assert.match(list, /공고를 불러오지 못했습니다\. 잠시 뒤 다시 시도해 주십시오\./);
  assert.match(list, /data-retry>다시 시도/);
  assert.match(list, /class="nt-title">공고/);
  assert.match(N.failHtml(true), /← 공고 목록.*data-retry>다시 시도/s);
});
