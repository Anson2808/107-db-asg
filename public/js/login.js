/**
 * login.js — Login form handler for CoWork
 */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  // Redirect if already logged in
  if (isLoggedIn()) {
    redirectByRole();
    return;
  }

  const form = document.getElementById("loginForm");
  const errorEl = document.getElementById("loginError");
  const submitBtn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      redirectByRole();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? "Logging in..." : "Log In";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function hideError() {
    errorEl.style.display = "none";
  }

  function redirectByRole() {
    const user = getUser();
    if (user && user.role === "stallOwner") {
      window.location.href = "/stall-dashboard.html";
    } else {
      window.location.href = "/";
    }
  }
});
