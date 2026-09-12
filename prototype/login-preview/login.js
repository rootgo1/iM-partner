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
})();
