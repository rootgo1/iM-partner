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
      if (message.type() === "error") {
        const location = message.location();
        errors.push(prefix + " console: " + message.text() + (location.url ? " @ " + location.url : ""));
      }
    });
  }

  async function desktopMetrics(page) {
    return page.evaluate(() => {
      const rect = (selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
      };
      return {
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
        bodyWidth: document.body.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        shellColumns: getComputedStyle(document.querySelector(".guest-shell")).gridTemplateColumns,
        font: getComputedStyle(document.body).fontFamily,
        logoReady: document.querySelector(".brand-mark img").complete && document.querySelector(".brand-mark img").naturalWidth > 0,
        shell: rect(".guest-shell"),
        value: rect(".value-panel"),
        access: rect("#accessCard"),
        lastFeature: rect(".feature-list li:last-child"),
        loginButton: rect("#loginButton"),
        firstInput: rect("#userId")
      };
    });
  }

  function assertDesktopFits(metrics, label) {
    assert.ok(metrics.bodyWidth <= metrics.viewportWidth, label + "에서 가로 넘침이 없어야 합니다.");
    assert.equal(metrics.shellColumns.split(" ").length, 2, label + "에서 2열이어야 합니다.");
    assert.ok(metrics.value.bottom <= metrics.documentHeight + 1, label + "에서 왼쪽 패널이 잘리지 않아야 합니다.");
    assert.ok(metrics.access.bottom <= metrics.documentHeight + 1, label + "에서 시작하기 카드가 잘리지 않아야 합니다.");
    assert.ok(metrics.lastFeature.bottom <= metrics.value.bottom + 1, label + "에서 마지막 서비스 항목이 패널 안에 있어야 합니다.");
    assert.ok(metrics.loginButton.bottom <= metrics.access.bottom + 1, label + "에서 로그인 버튼이 카드 안에 있어야 합니다.");
    assert.ok(Math.abs(metrics.loginButton.width - metrics.firstInput.width) <= 1, "입력창과 버튼 너비가 같아야 합니다.");
    assert.ok(Math.abs(metrics.value.height - metrics.access.height) <= 1, "양쪽 패널 높이가 같아야 합니다.");
  }

  try {
    const desktopSizes = [
      { width: 1366, height: 768, name: "guest-notebook-1366x768.png", label: "1366×768" },
      { width: 1440, height: 900, name: "guest-desktop-1440x900.png", label: "1440×900" },
      { width: 2048, height: 1151, name: "guest-desktop-2048x1151.png", label: "2048×1151" }
    ];

    for (const size of desktopSizes) {
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
      collectErrors(page, size.label);
      await page.goto(loginUrl, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const metrics = await desktopMetrics(page);
      assertDesktopFits(metrics, size.label);
      assert.match(metrics.font, /iM Noto Sans KR/);
      assert.equal(metrics.logoReady, true);
      assert.ok(metrics.access.width >= 390 && metrics.access.width < 570);
      assert.equal(await page.locator(".value-panel img, .guest-state, .safe-notice, #credentialGuide, .form-title-row").count(), 0);
      assert.equal(await page.locator("#accessTitle").innerText(), "아이디 로그인");
      await page.screenshot({ path: path.join(output, size.name) });

      if (size.width === 1440) {
        assert.equal(await page.locator("#guestTitle").innerText(), "내 가게의 흐름을\n오늘의 행동으로");
        assert.equal(await page.locator(".lead").innerText(), "매출부터 운영 전략까지\n내 가게에 필요한 정보를 한곳에서 확인하세요.");

        const contrast = await page.evaluate(() => {
          function luminance(rgb) {
            const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => {
              value /= 255;
              return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
          }
          const style = getComputedStyle(document.querySelector("#loginButton"));
          const lighter = Math.max(luminance(style.color), luminance(style.backgroundColor));
          const darker = Math.min(luminance(style.color), luminance(style.backgroundColor));
          return (lighter + 0.05) / (darker + 0.05);
        });
        assert.ok(contrast >= 4.5, "로그인 버튼 명암비가 4.5:1 이상이어야 합니다.");

        await page.getByRole("button", { name: "로그인", exact: true }).click();
        assert.equal(await page.locator("#userId").getAttribute("aria-invalid"), "true");
        assert.match(await page.locator("#loginStatus").textContent(), /아이디를 입력/);
        assertDesktopFits(await desktopMetrics(page), "1440×900 오류 표시 상태");

        await page.locator("#userId").fill("preview-user");
        await page.locator("#userPassword").fill("preview-password");
        await page.getByRole("button", { name: "보기" }).click();
        assert.equal(await page.locator("#userPassword").getAttribute("type"), "text");
        await page.getByRole("button", { name: "로그인", exact: true }).click();
        assert.match(await page.locator("#loginStatus").innerText(), /현재 로그인할 수 없습니다/);
      }

      await page.close();
    }

    const rootPage = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    collectErrors(rootPage, "root");
    await rootPage.goto(rootUrl, { waitUntil: "load" });
    const appFrame = rootPage.frameLocator(".app-frame");
    await appFrame.locator("#loginButton").waitFor();
    assert.equal(await appFrame.locator("#demoEntryLink").count(), 0);
    await rootPage.frames()[1].goto(pathToFileURL(path.resolve(__dirname, '../main-screen.html')).href + '#dashboard');
    await appFrame.locator("#profileMenuButton").click();
    await appFrame.locator("#logoutLink").waitFor({ state: "visible" });
    assert.match(rootPage.frames()[1].url(), /main-screen\.html#dashboard$/);
    await appFrame.locator("#logoutLink").click();
    await appFrame.locator("#accessCard").waitFor();
    assert.match(rootPage.frames()[1].url(), /login-preview\/index\.html\?signed_out=1$/);
    assert.equal(await appFrame.locator("#loginStatus").textContent(), "");
    await rootPage.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    collectErrors(mobile, "mobile");
    await mobile.goto(loginUrl, { waitUntil: "load" });
    await mobile.evaluate(() => document.fonts.ready);
    const mobileLayout = await mobile.evaluate(() => ({
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      columns: getComputedStyle(document.querySelector(".guest-shell")).gridTemplateColumns,
      loginHeight: document.querySelector("#loginButton").getBoundingClientRect().height,
      loginWidth: document.querySelector("#loginButton").getBoundingClientRect().width,
      passwordWidth: document.querySelector(".password-field").getBoundingClientRect().width
    }));
    assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, "모바일 가로 넘침이 없어야 합니다.");
    assert.equal(mobileLayout.columns.split(" ").length, 1);
    assert.ok(mobileLayout.loginHeight >= 48);
    assert.ok(Math.abs(mobileLayout.loginWidth - mobileLayout.passwordWidth) <= 1, "모바일 비밀번호 입력창과 버튼의 너비가 같아야 합니다.");
    await mobile.screenshot({ path: path.join(output, "guest-mobile-390x844.png"), fullPage: true });
    await mobile.close();

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
    assert.equal(await noScriptPage.locator("#demoEntryLink").count(), 0);
    await noScriptContext.close();

    assert.deepEqual(errors, []);
    console.log("PASS desktop one-screen layout, mobile layout, copy, guest/login entry, logout return, and no-script safety");
    console.log("OUTPUT " + output);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
