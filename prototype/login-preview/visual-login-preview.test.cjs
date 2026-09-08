"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async function () {
  const browserCandidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  ];
  const executablePath = browserCandidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(executablePath, "Chrome 또는 Edge가 필요합니다.");

  const output = path.resolve(__dirname, "../../tmp/login-preview-qa");
  fs.mkdirSync(output, { recursive: true });
  const loginUrl = pathToFileURL(path.join(__dirname, "index.html")).href;
  const rootUrl = pathToFileURL(path.resolve(__dirname, "../../index.html")).href;
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath });

  function collectErrors(page, prefix) {
    page.on("pageerror", (error) => errors.push(prefix + " pageerror: " + error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(prefix + " console: " + message.text());
    });
  }

  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    collectErrors(desktop, "desktop");
    await desktop.goto(loginUrl, { waitUntil: "load" });
    await desktop.evaluate(() => document.fonts.ready);

    const desktopLayout = await desktop.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      shellColumns: getComputedStyle(document.querySelector(".guest-shell")).gridTemplateColumns,
      accessWidth: document.querySelector("#accessCard").getBoundingClientRect().width,
      font: getComputedStyle(document.body).fontFamily,
      logoReady: document.querySelector(".brand-mark img").complete && document.querySelector(".brand-mark img").naturalWidth > 0,
      artworkReady: document.querySelector(".preview-art img").complete && document.querySelector(".preview-art img").naturalWidth > 0
    }));
    assert.ok(desktopLayout.bodyWidth <= desktopLayout.viewportWidth, "데스크톱 가로 넘침이 없어야 합니다.");
    assert.equal(desktopLayout.shellColumns.split(" ").length, 2);
    assert.ok(desktopLayout.accessWidth >= 390 && desktopLayout.accessWidth < 560);
    assert.match(desktopLayout.font, /iM Noto Sans KR/);
    assert.equal(desktopLayout.logoReady, true);
    assert.equal(desktopLayout.artworkReady, true);

    const contrast = await desktop.evaluate(() => {
      function luminance(rgb) {
        const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
          value /= 255;
          return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      }
      const element = document.querySelector("#loginButton");
      const style = getComputedStyle(element);
      const lighter = Math.max(luminance(style.color), luminance(style.backgroundColor));
      const darker = Math.min(luminance(style.color), luminance(style.backgroundColor));
      return (lighter + 0.05) / (darker + 0.05);
    });
    assert.ok(contrast >= 4.5, "시연용 로그인 버튼 명암비가 4.5:1 이상이어야 합니다.");
    await desktop.screenshot({ path: path.join(output, "guest-desktop-1440x1000.png"), fullPage: true });

    await desktop.getByRole("button", { name: "회복 플랜" }).click();
    assert.match(await desktop.locator("#targetNotice").textContent(), /골목상권 회복 플랜/);
    assert.match(await desktop.locator("#demoEntryLink").getAttribute("href"), /#recovery$/);

    await desktop.getByRole("button", { name: "시연용 로그인", exact: true }).click();
    assert.equal(await desktop.locator("#userId").getAttribute("aria-invalid"), "true");
    assert.match(await desktop.locator("#loginStatus").textContent(), /임의 아이디를 입력/);

    await desktop.locator("#userId").fill("preview-user");
    await desktop.locator("#userPassword").fill("preview-password");
    await desktop.getByRole("button", { name: "보기" }).click();
    assert.equal(await desktop.locator("#userPassword").getAttribute("type"), "text");
    await desktop.getByRole("button", { name: "시연용 로그인", exact: true }).click();
    await desktop.waitForURL(/main-screen\.html#recovery$/);
    assert.match(desktop.url(), /main-screen\.html#recovery$/);

    const rootPage = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    collectErrors(rootPage, "root");
    await rootPage.goto(rootUrl, { waitUntil: "load" });
    const appFrame = rootPage.frameLocator(".app-frame");
    await appFrame.getByRole("link", { name: "로그인 없이 데모 시작" }).click();
    await appFrame.locator("#logoutLink").waitFor();
    assert.match(rootPage.frames()[1].url(), /main-screen\.html#dashboard$/);
    await appFrame.locator("#logoutLink").click();
    await appFrame.locator("#accessCard").waitFor();
    assert.match(rootPage.frames()[1].url(), /login-preview\/index\.html\?signed_out=1$/);
    assert.match(await appFrame.locator("#loginStatus").textContent(), /비로그인 화면으로 돌아왔습니다/);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    collectErrors(mobile, "mobile");
    await mobile.goto(loginUrl, { waitUntil: "load" });
    await mobile.evaluate(() => document.fonts.ready);
    const mobileLayout = await mobile.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      navHidden: getComputedStyle(document.querySelector(".guest-nav")).display === "none",
      columns: getComputedStyle(document.querySelector(".guest-shell")).gridTemplateColumns,
      loginHeight: document.querySelector("#loginButton").getBoundingClientRect().height,
      guestHeight: document.querySelector("#demoEntryLink").getBoundingClientRect().height
    }));
    assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, "모바일 가로 넘침이 없어야 합니다.");
    assert.equal(mobileLayout.navHidden, true);
    assert.equal(mobileLayout.columns.split(" ").length, 1);
    assert.ok(mobileLayout.loginHeight >= 48);
    assert.ok(mobileLayout.guestHeight >= 68);
    await mobile.screenshot({ path: path.join(output, "guest-mobile-390x844.png"), fullPage: true });

    const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
    const noScriptPage = await noScriptContext.newPage();
    await noScriptPage.goto(loginUrl, { waitUntil: "load" });
    const initialUrl = noScriptPage.url();
    await noScriptPage.locator("#userId").fill("real-account-must-not-leak");
    await noScriptPage.locator("#userPassword").fill("real-password-must-not-leak");
    await noScriptPage.locator("#loginButton").click();
    await noScriptPage.locator("#userPassword").press("Enter");
    assert.equal(noScriptPage.url(), initialUrl);
    assert.ok(!noScriptPage.url().includes("real-account-must-not-leak"));
    assert.ok(!noScriptPage.url().includes("real-password-must-not-leak"));
    assert.equal(await noScriptPage.getByRole("link", { name: "로그인 없이 데모 시작" }).getAttribute("href"), "../main-screen.html#dashboard");
    await noScriptContext.close();

    assert.deepEqual(errors, []);
    console.log("PASS desktop/mobile layout, target selection, guest/login entry, logout return, and no-script safety");
    console.log("OUTPUT " + output);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
