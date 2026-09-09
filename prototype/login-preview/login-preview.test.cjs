"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "login.css"), "utf8");
const js = fs.readFileSync(path.join(root, "login.js"), "utf8");
const siteEntry = fs.readFileSync(path.resolve(root, "../../index.html"), "utf8");
const mainHtml = fs.readFileSync(path.resolve(root, "../main-screen.html"), "utf8");
const mainJs = fs.readFileSync(path.resolve(root, "../meeting-ui.js"), "utf8");

let passed = 0;
function check(message, fn) {
  fn();
  console.log("PASS " + message);
  passed++;
}

check("all local assets exist", () => {
  for (const asset of [
    "index.html",
    "login.css",
    "login.js",
    "../assets/brand/im-bank-favicon.ico",
    "../assets/brand/im-bank-symbol.png",
    "../assets/fonts/noto-sans-kr.css"
  ]) assert.ok(fs.existsSync(path.resolve(root, asset)), "Missing asset: " + asset);
});

check("root entry starts at the non-logged-in screen", () => {
  assert.match(siteEntry, /src="\.\/prototype\/login-preview\/index\.html"/);
  assert.match(siteEntry, /title="iM파트너 로그인 및 서비스"/);
  assert.ok(!/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/.test(siteEntry));
});

check("document metadata and ids are valid", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "Duplicate id detected");
  assert.match(html, /lang="ko"/);
  assert.match(html, /<title>시작하기 \| iM파트너<\/title>/);
  assert.match(html, /<h1 id="guestTitle">내 가게의 흐름을<br><strong>오늘의 행동으로<\/strong><\/h1>/);
  assert.ok(!html.includes("오늘의 행동으로."));
  assert.match(html, /매출·지출부터 상권의 시간대별 기회까지 한곳에서 살펴보고<br>지금 실행할 회복 행동을 확인해 보세요\./);
  assert.match(html, /<h2 id="accessTitle">iM파트너 시작하기<\/h2>/);
});

check("guest entry matches the existing product flow", () => {
  assert.match(html, /로그인 없이 데모 시작/);
  assert.match(html, /생성 데이터 기반 시연/);
  assert.match(html, /가게 현황<\/strong><small>기간별 매출·지출과 비용 비중 확인/);
  assert.match(html, /기회 시간대<\/strong><small>통행→입장→결제에서 먼저 볼 구간 점검/);
  assert.match(html, /실행·비교<\/strong><small>오늘의 행동을 정하고 7일 뒤 같은 조건 확인/);
  assert.ok(!/flow-strip|flowTitle|서비스 이용 흐름/.test(html));
  assert.ok(!/\.flow-strip|\.site-footer/.test(css));
});

check("prototype credentials cannot submit or leave the page", () => {
  assert.match(html, /id="demoLoginForm"[^>]*role="form"/);
  assert.match(html, /id="userId"[^>]+autocomplete="off"/);
  assert.match(html, /id="userPassword"[^>]+autocomplete="off"/);
  assert.ok(!/<form[^>]+id="demoLoginForm"/.test(html));
  assert.ok(!/id="user(?:Id|Password)"[^>]+\bname=/.test(html));
  assert.match(html, /id="loginButton" type="button"/);
  assert.match(html, /실제 계정정보 입력 금지/);
  assert.match(html, /입력값은 저장·전송되지 않으며 실제 인증·금융거래·대출 신청은 진행하지 않습니다/);
  assert.ok(!/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/.test(js));
});

check("guest and demo-login paths route to the selected existing view", () => {
  assert.match(js, /return "\.\.\/main-screen\.html#" \+ view/);
  assert.match(js, /window\.location\.assign\(destination\(targetView\)\)/);
  assert.match(js, /임의 아이디를 입력해 주세요/);
  assert.match(js, /임의 비밀번호를 입력해 주세요/);
  assert.match(js, /goToDemo\("guest"\)/);
  assert.match(js, /goToDemo\("login"\)/);
  assert.match(js, /new URLSearchParams\(window\.location\.search\)/);
});

check("logout returns from the main screen and destroys in-memory demo state", () => {
  assert.match(mainHtml, /id="logoutLink" href="\.\/login-preview\/index\.html\?signed_out=1"/);
  assert.match(mainHtml, /로그아웃하고 비로그인 화면으로 이동/);
  assert.match(mainJs, /window\.location\.replace\(event\.currentTarget\.href\)/);
});

check("responsive and accessibility contracts are present", () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /id="loginStatus"[^>]+aria-live="polite"/);
  assert.match(html, /id="accessCard"[^>]+tabindex="-1"/);
  assert.match(css, /@media \(max-width: 1060px\)/);
  assert.match(css, /@media \(min-width: 1061px\)/);
  assert.match(css, /@media \(min-width: 1061px\) and \(max-height: 940px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});

console.log("TOTAL " + passed + " checks passed");
