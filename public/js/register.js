/**
 * register.js — Registration form handler for CoWork
 */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  // Redirect if already logged in
  if (isLoggedIn()) {
    window.location.href = "/";
    return;
  }

  const form = document.getElementById("registerForm");
  const errorEl = document.getElementById("registerError");
  const submitBtn = form.querySelector("button[type='submit']");
  const roleInput = document.getElementById("role");
  const stallFields = document.getElementById("stallFields");
  const roleButtons = document.querySelectorAll("#roleToggle button");

  // Role toggle
  roleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      roleButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const role = btn.dataset.role;
      roleInput.value = role;

      if (role === "stallOwner") {
        stallFields.classList.add("visible");
        document.getElementById("stallName").required = true;
        document.getElementById("cuisineType").required = true;
      } else {
        stallFields.classList.remove("visible");
        document.getElementById("stallName").required = false;
        document.getElementById("cuisineType").required = false;
      }
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const payload = {
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value,
      email: document.getElementById("email").value.trim(),
      fullName: document.getElementById("fullName").value.trim(),
      role: roleInput.value,
    };

    if (payload.role === "stallOwner") {
      payload.stallName = document.getElementById("stallName").value.trim();
      payload.cuisineType = document.getElementById("cuisineType").value.trim();
    }

    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Auto-login after successful registration
      const loginData = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: payload.username,
          password: payload.password,
        }),
      });

      localStorage.setItem("token", loginData.token);
      localStorage.setItem("user", JSON.stringify(loginData.user));

      if (loginData.user.role === "stallOwner") {
        window.location.href = "/stall-dashboard.html";
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? "Registering..." : "Register";
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  function hideError() {
    errorEl.style.display = "none";
  }
});
