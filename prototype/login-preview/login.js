(function () {
  "use strict";

  const userId = document.getElementById("userId");
  const userPassword = document.getElementById("userPassword");
  const passwordToggle = document.getElementById("passwordToggle");
  const loginButton = document.getElementById("loginButton");
  const loginStatus = document.getElementById("loginStatus");
  const accessCard = document.getElementById("accessCard");
  const targetNotice = document.getElementById("targetNotice");
  const demoLinks = [document.getElementById("headerDemoLink"), document.getElementById("demoEntryLink")];
  const toast = document.getElementById("toast");

  const viewNames = {
    dashboard: "대시보드",
    market: "상권·시간 분석",
    finance: "매출·지출 분석",
    recovery: "골목상권 회복 플랜",
    policies: "정책·지원사업",
    secretary: "AI 비서"
  };

  let targetView = "dashboard";
  let toastTimer = 0;
  let loginTimer = 0;

  function destination(view) {
    return "../main-screen.html#" + view;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 3000);
  }

  function setLoginStatus(message, state) {
    loginStatus.textContent = message;
    loginStatus.className = "login-status" + (state ? " " + state : "");
  }

  function clearFieldError(field) {
    field.removeAttribute("aria-invalid");
  }

  function resetLoginButton() {
    loginButton.disabled = false;
    loginButton.querySelector("span").textContent = "시연용 로그인";
  }

  function cancelPendingLogin(message) {
    window.clearTimeout(loginTimer);
    loginTimer = 0;
    resetLoginButton();
    if (message) setLoginStatus(message, "");
  }

  function setTarget(view) {
    if (!viewNames[view]) return;
    targetView = view;
    demoLinks.forEach(function (link) {
      link.href = destination(view);
    });
    targetNotice.innerHTML = '<span aria-hidden="true">↳</span> 시작하면 ' + viewNames[view] + " 화면으로 이동합니다.";
    document.querySelectorAll("[data-login-required]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.targetView === view);
    });
  }

  function goToDemo(source) {
    cancelPendingLogin();
    const sourceLabel = source === "login" ? "시연용 입력을 확인했습니다." : "계정 입력 없이 데모를 시작합니다.";
    setLoginStatus(sourceLabel + " " + viewNames[targetView] + " 화면으로 이동합니다.", "success");
    loginButton.disabled = true;
    loginButton.querySelector("span").textContent = "이동 중";
    loginTimer = window.setTimeout(function () {
      loginTimer = 0;
      window.location.assign(destination(targetView));
    }, 260);
  }

  document.querySelectorAll("[data-login-required]").forEach(function (button) {
    button.addEventListener("click", function () {
      setTarget(button.dataset.targetView);
      showToast(viewNames[targetView] + "은(는) 시작 후 이용할 수 있습니다.");
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      accessCard.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      window.setTimeout(function () {
        accessCard.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 220);
    });
  });

  demoLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      goToDemo("guest");
    });
  });

  passwordToggle.addEventListener("click", function () {
    const show = userPassword.type === "password";
    userPassword.type = show ? "text" : "password";
    passwordToggle.textContent = show ? "숨기기" : "보기";
    passwordToggle.setAttribute("aria-pressed", String(show));
    userPassword.focus({ preventScroll: true });
  });

  [userId, userPassword].forEach(function (field) {
    field.addEventListener("input", function () {
      if (loginTimer) cancelPendingLogin("입력 내용이 변경되었습니다. 다시 확인해 주세요.");
      clearFieldError(field);
      if (loginStatus.classList.contains("error")) setLoginStatus("", "");
    });
  });

  function attemptLogin() {
    cancelPendingLogin();
    clearFieldError(userId);
    clearFieldError(userPassword);

    if (!userId.value.trim()) {
      userId.setAttribute("aria-invalid", "true");
      setLoginStatus("임의 아이디를 입력해 주세요.", "error");
      userId.focus();
      return false;
    }

    if (!userPassword.value) {
      userPassword.setAttribute("aria-invalid", "true");
      setLoginStatus("임의 비밀번호를 입력해 주세요.", "error");
      userPassword.focus();
      return false;
    }

    loginButton.disabled = true;
    loginButton.querySelector("span").textContent = "확인 중";
    setLoginStatus("입력 화면 동작을 확인하고 있습니다.", "");
    loginTimer = window.setTimeout(function () {
      loginTimer = 0;
      goToDemo("login");
    }, 420);
    return true;
  }

  loginButton.addEventListener("click", attemptLogin);

  [userId, userPassword].forEach(function (field) {
    field.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      attemptLogin();
    });
  });

  window.addEventListener("pageshow", function () {
    if (loginTimer) cancelPendingLogin();
    else resetLoginButton();
  });

  if (new URLSearchParams(window.location.search).get("signed_out") === "1") {
    setLoginStatus("시연을 종료하고 비로그인 화면으로 돌아왔습니다.", "success");
    showToast("로그아웃되었습니다. 화면에서 바꾼 정보는 저장되지 않습니다.");
  }

  setTarget("dashboard");
})();
