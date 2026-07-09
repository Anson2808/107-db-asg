/**
 * auth.js — Auth helpers + navbar rendering for CoWork
 */

function getToken() {
  return localStorage.getItem("token");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!getToken() && !!getUser();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login.html";
}

function isRole(role) {
  const user = getUser();
  return user && user.role === role;
}

/**
 * Renders the shared navbar into <nav id="navbar"></nav>.
 * Call this on DOMContentLoaded on every page.
 */
function renderNavbar() {
  const container = document.getElementById("navbar");
  if (!container) return;

  const user = getUser();

  let leftLinks = `<a href="/">Home</a>`;
  let rightLinks = "";

  if (user) {
    if (user.role === "stallOwner") {
      leftLinks += `<a href="/stall-dashboard.html">My Stall</a>`;
      leftLinks += `<a href="/stall-analytics.html">Analytics</a>`;
    }
    leftLinks += `<a href="/order-history.html">Order History</a>`;
    rightLinks = `
      <span class="navbar-user">${escapeHtml(user.username)}</span>
      <button onclick="logout()">Logout</button>
    `;
  } else {
    rightLinks = `
      <a href="/login.html">Login</a>
      <a href="/register.html" class="btn-primary">Register</a>
    `;
  }

  container.innerHTML = `
    <div class="navbar">
      <div class="navbar-inner">
        <a href="/" class="navbar-brand">CoWork</a>
        <div class="navbar-links">
          ${leftLinks}
          ${rightLinks}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
