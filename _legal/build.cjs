// 약관 게시본(_legal/*.md)을 /terms·/policy·/dpa·/subprocessors 페이지로 만든다 (PW-1773).
//
// 원본 md 는 기획(David)이 Jira PW-1773 에 붙인 게시본을 그대로 둔 것이다 — 고치지 말고 새 판으로 갈아 끼운다.
// md 안의 YYYY-MM-DD 는 «페이지를 올린 날 = 시행일» 자리표다. 올리는 날을 인자로 넘겨 채운다.
// 같은 날짜가 pivit-work backend `identity/users/legal-documents.ts` 의 판(가입 동의 기록)과 같아야 한다.
//
// _ 로 시작하는 폴더라 GitHub Pages(Jekyll)가 이 폴더를 게시하지 않는다.
//
//   npm install --prefix /tmp/mk marked@15.0.12
//   NODE_PATH=/tmp/mk/node_modules node _legal/build.cjs 2026-10-23
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const DOCS = [
  { id: 'terms', description: 'PIVIT.WORK 서비스 이용약관' },
  { id: 'policy', description: 'PIVIT.WORK 운영정책' },
  { id: 'dpa', description: 'PIVIT.WORK 개인정보 처리위탁계약서' },
  { id: 'subprocessors', description: 'PIVIT.WORK 재수탁자(하위 수탁자) 목록' },
];

const effective = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(effective || '')) {
  console.error('사용법: node _legal/build.cjs <시행일 YYYY-MM-DD>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
// 생김새는 이미 게시된 처리방침 페이지와 같게 — 그 페이지의 <style> 을 그대로 가져와 약관에만 있는 요소를 더한다.
const privacyHtml = fs.readFileSync(path.join(root, 'privacy/index.html'), 'utf8');
const baseStyle = privacyHtml.match(/<style>([\s\S]*?)<\/style>/)[1].trim();
const extraStyle = [
  'h3{font-size:16px;margin:28px 0 8px}',
  'h4{font-size:15px;margin:20px 0 6px}',
  'blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--border);color:var(--sub);background:var(--bg);border-radius:0 8px 8px 0}',
  'blockquote p{margin:4px 0}',
  'hr{border:0;border-top:1px solid var(--border);margin:28px 0}',
].join('\n');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

for (const doc of DOCS) {
  const md = fs.readFileSync(path.join(__dirname, `${doc.id}.md`), 'utf8');
  if (/<!--/.test(md)) throw new Error(`${doc.id}.md 에 HTML 주석이 남아 있다 — 게시본이 아니다`);
  const filled = md.replace(/YYYY-MM-DD/g, effective);
  const title = filled.match(/^# (.+)$/m)[1].trim();
  const body = marked
    .parse(filled, { gfm: true })
    // 넓은 표는 처리방침처럼 가로로 밀리게 감싼다
    .replace(/<table>/g, '<div class="tbl"><table>')
    .replace(/<\/table>/g, '</table></div>')
    .trim();
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — Pivit</title>
<meta name="description" content="${escapeHtml(doc.description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
${baseStyle}
${extraStyle}
</style>
</head>
<body>
<header><div class="wrap top"><a class="logo" href="/"><span class="logo-icon">P</span>Pivit</a></div></header>
<div class="wrap">
<main>
${body}
</main>
<footer>© 2026 Pivit · <a href="/">pivit.work</a></footer>
</div>
</body>
</html>
`;
  const out = path.join(root, doc.id, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`${doc.id}/index.html — ${title}`);
}
