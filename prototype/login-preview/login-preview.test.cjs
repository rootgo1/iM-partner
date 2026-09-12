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
  assert.match(html, /<title>로그인 \| iM파트너<\/title>/);
  assert.match(html, /<h1 id="guestTitle">내 가게의 흐름을<br><strong>오늘의 행동으로<\/strong><\/h1>/);
  assert.ok(!html.includes("오늘의 행동으로."));
  assert.match(html, /매출부터 운영 전략까지<br>내 가게에 필요한 정보를 한곳에서 확인하세요\./);
  assert.match(html, /<h2 id="accessTitle">아이디 로그인<\/h2>/);
});

check("guest entry matches the existing product flow", () => {
  assert.ok(!html.includes("로그인 없이 데모 시작"));
  assert.ok(!html.includes("생성 데이터 기반 시연"));
  assert.ok(!/service-preview|login-dashboard/.test(html));
  assert.match(html, /매출진단<\/strong><small>매출·지출과 상권 흐름을 한눈에 확인하세요/);
  assert.match(html, /회복전략<\/strong><small>우리 가게에 필요한 운영 개선 방향을 찾아보세요/);
  assert.match(html, /iM비서<\/strong><small>경영 질문부터 분석 보고서까지 간편하게 확인하세요/);
  assert.ok(!/flow-strip|flowTitle|서비스 이용 흐름/.test(html));
  assert.ok(!/\.flow-strip|\.site-footer/.test(css));
});

check("prototype credentials cannot submit or leave the page", () => {
  assert.match(html, /id="loginForm"[^>]*role="form"/);
  assert.match(html, /id="userId"[^>]+autocomplete="off"/);
  assert.match(html, /id="userPassword"[^>]+autocomplete="off"/);
  assert.ok(!/<form[^>]+id="loginForm"/.test(html));
  assert.ok(!/id="user(?:Id|Password)"[^>]+\bname=/.test(html));
  assert.match(html, /id="loginButton" type="button"/);
  assert.ok(!/비로그인 상태|계정으로 로그인|credentialGuide|safe-notice/.test(html));
  assert.ok(!/로그아웃되었습니다|signed_out/.test(js));
  assert.ok(!/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/.test(js));
});

check("unconnected authentication cannot accept arbitrary credentials", () => {
  assert.ok(!/goToDemo|location\.assign|location\.replace/.test(js));
  assert.match(js, /아이디를 입력해 주세요/);
  assert.match(js, /비밀번호를 입력해 주세요/);
  assert.match(js, /현재 로그인할 수 없습니다/);
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
  assert.match(css, /@media \(min-width: 1061px\) and \(max-height: 800px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

console.log("TOTAL " + passed + " checks passed");
