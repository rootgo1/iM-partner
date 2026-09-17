(function () {
  "use strict";

  const userId = document.getElementById("userId");
  const userPassword = document.getElementById("userPassword");
  const passwordToggle = document.getElementById("passwordToggle");
  const loginButton = document.getElementById("loginButton");
  const loginStatus = document.getElementById("loginStatus");

  function setLoginStatus(message, state) {
    loginStatus.textContent = message;
    loginStatus.className = "login-status" + (state ? " " + state : "");
  }

  passwordToggle.addEventListener("click", function () {
    const show = userPassword.type === "password";
    userPassword.type = show ? "text" : "password";
    passwordToggle.textContent = show ? "숨기기" : "보기";
    passwordToggle.setAttribute("aria-pressed", String(show));
    userPassword.focus({ preventScroll: true });
  });

  function attemptLogin() {
    [userId, userPassword].forEach(function (field) { field.removeAttribute("aria-invalid"); });
    const missing = !userId.value.trim() ? userId : !userPassword.value ? userPassword : null;
    if (missing) {
      missing.setAttribute("aria-invalid", "true");
      setLoginStatus(missing === userId ? "아이디를 입력해 주세요." : "비밀번호를 입력해 주세요.", "error");
      missing.focus();
      return;
    }
    // No authentication backend exists in this static project. Never accept arbitrary credentials.
    userPassword.value = "";
    setLoginStatus("현재 로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.", "error");
  }

  loginButton.addEventListener("click", attemptLogin);
  [userId, userPassword].forEach(function (field) {
    field.addEventListener("input", function () { field.removeAttribute("aria-invalid"); setLoginStatus("", ""); });
    field.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      attemptLogin();
    });
  });
  window.addEventListener("pageshow", function () { userPassword.value = ""; });

  const accountDialog = document.getElementById("accountDemoDialog");
  const accountFields = document.getElementById("accountDemoFields");
  const accountStatus = document.getElementById("accountDemoStatus");
  const accountContinue = document.getElementById("accountDemoContinue");
  const accountResult = document.getElementById("accountDemoResult");
  let accountMode = "signup";
  let accountTrigger = null;
  const accountScreens = {
    signup: {
      title: "회원가입 화면 시연",
      fields: [["demoName", "이름", "text", "예: 이소현"], ["demoEmail", "이메일", "email", "예: owner@example.com"], ["demoId", "아이디", "text", "예: sohyun_demo"], ["demoPassword", "비밀번호", "password", "시연용 비밀번호 8자 이상"], ["demoPasswordConfirm", "비밀번호 확인", "password", "같은 시연용 비밀번호"]],
      result: "회원가입 입력 형식을 확인했습니다. 실제 계정은 만들어지지 않았으며 입력값은 지웠습니다. 데모 서비스는 별도 가입 없이 살펴볼 수 있습니다."
    },
    "find-id": {
      title: "아이디 찾기 화면 시연",
      fields: [["demoName", "이름", "text", "예: 이소현"], ["demoEmail", "이메일", "email", "예: owner@example.com"]],
      result: "입력 형식을 확인했습니다. 계정 조회와 본인확인은 수행하지 않았습니다. 화면에 사용하는 예시 아이디는 sohyun_demo이며 입력값과 연결된 조회 결과가 아닙니다. 입력값은 지웠습니다."
    },
    "reset-password": {
      title: "비밀번호 찾기 화면 시연",
      fields: [["demoId", "아이디", "text", "예: sohyun_demo"], ["demoEmail", "이메일", "email", "예: owner@example.com"], ["demoPassword", "새 비밀번호", "password", "시연용 비밀번호 8자 이상"], ["demoPasswordConfirm", "새 비밀번호 확인", "password", "같은 시연용 비밀번호"]],
      result: "비밀번호 변경 화면의 입력 형식을 확인했습니다. 실제 본인확인·인증 메일 발송·비밀번호 변경은 처리하지 않았으며 입력값은 지웠습니다."
    }
  };
  function clearAccountFields() {
    accountFields.querySelectorAll("input").forEach(function (input) { input.value = ""; });
    accountFields.replaceChildren();
    accountStatus.textContent = "";
  }
  function openAccountDemo(mode, trigger) {
    if (!accountScreens[mode]) return;
    accountMode = mode; accountTrigger = trigger;
    clearAccountFields();
    const screen = accountScreens[mode];
    document.getElementById("accountDemoTitle").textContent = screen.title;
    screen.fields.forEach(function (field) {
      const label = document.createElement("label"); label.className = "field";
      const caption = document.createElement("span"); caption.textContent = field[1];
      const input = document.createElement("input");
      input.id = field[0]; input.type = field[2]; input.placeholder = field[3]; input.required = true;
      input.autocomplete = "off"; input.maxLength = field[2] === "email" ? 100 : 64;
      input.setAttribute("aria-describedby", "accountDemoStatus");
      if (field[2] === "password") input.minLength = 8;
      label.append(caption, input); accountFields.append(label);
    });
    accountFields.hidden = false; accountContinue.hidden = false; accountResult.hidden = true;
    accountDialog.showModal(); accountFields.querySelector("input").focus();
  }
  function finishAccountDemo() {
    const inputs = Array.from(accountFields.querySelectorAll("input"));
    inputs.forEach(function (input) { input.removeAttribute("aria-invalid"); });
    const invalid = inputs.find(function (input) { return !input.value.trim() || !input.checkValidity(); });
    let issue = invalid;
    let message = invalid ? (invalid.type === "email" ? "이메일 형식을 확인해 주세요." : invalid.type === "password" && invalid.value ? "시연용 비밀번호는 8자 이상 입력해 주세요." : "필수 항목을 입력해 주세요.") : "";
    const password = document.getElementById("demoPassword");
    const confirmation = document.getElementById("demoPasswordConfirm");
    if (!issue && password && password.value !== confirmation.value) { issue = confirmation; message = "두 비밀번호가 같은지 확인해 주세요."; }
    if (issue) { accountStatus.textContent = message; accountStatus.className = "login-status error"; issue.setAttribute("aria-invalid", "true"); issue.focus(); return; }
    clearAccountFields(); accountFields.hidden = true; accountContinue.hidden = true;
    document.getElementById("accountDemoResultText").textContent = accountScreens[accountMode].result;
    accountResult.hidden = false; accountResult.focus();
  }
  document.querySelectorAll("[data-account-demo]").forEach(function (trigger) {
    trigger.addEventListener("click", function () { openAccountDemo(trigger.dataset.accountDemo, trigger); });
  });
  accountContinue.addEventListener("click", finishAccountDemo);
  accountFields.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); finishAccountDemo(); }
  });
  document.getElementById("accountDemoClose").addEventListener("click", function () { accountDialog.close(); });
  accountDialog.addEventListener("cancel", clearAccountFields);
  accountDialog.addEventListener("close", function () { clearAccountFields(); accountTrigger?.focus(); });
  window.addEventListener("pagehide", clearAccountFields);
})();
