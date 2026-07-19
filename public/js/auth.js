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

function tr(key) {
  if (typeof t === "function") return t(key);

  const fallback = {
    home: "Home",
    cart: "Cart",
    login: "Login",
    register: "Register",
    logout: "Logout",
    orderHistory: "Order History",
    feedbackComplaint: "Feedback / Complaint",
    myStall: "My Stall",
    analytics: "Analytics",
    inspections: "Inspections",
    language: "Language",
    theme: "Theme",
    lightMode: "Light",
    darkMode: "Dark",
    profile: "Profile",
  };

  return fallback[key] || key;
}

function currentLanguage() {
  return typeof getLanguage === "function" ? getLanguage() : "en";
}

function onLanguageChange(event) {
  if (typeof handleLanguageChange === "function") {
    handleLanguageChange(event);
  }
}

function currentTheme() {
  return typeof getTheme === "function" ? getTheme() : "light";
}

function onThemeChange(event) {
  if (typeof handleThemeChange === "function") {
    handleThemeChange(event);
  }
}

/**
 * Renders the shared navbar into <nav id="navbar"></nav>.
 * Call this on DOMContentLoaded on every page.
 */
function renderNavbar() {
  const container = document.getElementById("navbar");
  if (!container) return;

  const user = getUser();

  let leftLinks = `<a href="/">${tr("home")}</a>`;
  let rightLinks = "";

  if (user) {
    if (user.role === "stallOwner") {
      leftLinks += `<a href="/stall-dashboard.html">${tr("myStall")}</a>`;
      leftLinks += `<a href="/stall-analytics.html">${tr("analytics")}</a>`;
    } else if (user.role === "customer") {
      leftLinks += `<a href="/feedback.html">${tr("feedbackComplaint")}</a>`;
    } else if (user.role === "inspector") {
      leftLinks += `<a href="/inspector.html">${tr("inspections")}</a>`;
    }
    leftLinks += `<a href="/order-history.html">${tr("orderHistory")}</a>`;
    leftLinks += `<a href="/profile.html">${tr("profile")}</a>`;
    rightLinks = `
      ${user.role !== "inspector" ? `<a href="/cart.html">${tr("cart")} <span id="cart-badge" class="badge cart-badge-nav" style="display:none">0</span></a>` : ""}
      <span class="navbar-user">${escapeHtml(user.username)}</span>
      <button onclick="logout()">${tr("logout")}</button>
    `;
  } else {
    rightLinks = `
      <a href="/cart.html">${tr("cart")} <span id="cart-badge" class="badge cart-badge-nav" style="display:none">0</span></a>
      <a href="/login.html">${tr("login")}</a>
      <a href="/register.html" class="btn-primary">${tr("register")}</a>
    `;
  }

  container.innerHTML = `
    <div class="navbar">
      <div class="navbar-inner">
        <a href="/" class="navbar-brand">CoWork</a>
        <div class="navbar-links">
          ${leftLinks}
          ${rightLinks}
          <label class="language-control">
            <span>${tr("language")}</span>
            <select id="languageSelect" class="language-select" aria-label="${tr("language")}">
              <option value="en"${currentLanguage() === "en" ? " selected" : ""}>English</option>
              <option value="zh"${currentLanguage() === "zh" ? " selected" : ""}>中文</option>
            </select>
          </label>
          <label class="theme-control">
            <span>${tr("theme")}</span>
            <select id="themeSelect" class="theme-select" aria-label="${tr("theme")}">
              <option value="light"${currentTheme() === "light" ? " selected" : ""}>${tr("lightMode")}</option>
              <option value="dark"${currentTheme() === "dark" ? " selected" : ""}>${tr("darkMode")}</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  `;

  document.getElementById("languageSelect")?.addEventListener("change", onLanguageChange);
  document.getElementById("themeSelect")?.addEventListener("change", onThemeChange);
  updateCartBadge();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/**
 * Fetches the cart items from the backend and updates the cart badge
 * in the navbar to show the total quantity. Call this after any
 * add/remove/clear to keep the badge in sync.
 */
async function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;

  if (!isLoggedIn()) {
    // Guest: sum quantities from localStorage guest_cart
    const guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
    const totalQty = guestCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? "" : "none";
    return;
  }

  try {
    const res = await api("/cart");
    const cart = res.cart || [];
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? "" : "none";
  } catch (e) {
    console.error("Failed to update cart badge:", e);
    badge.style.display = "none";
  }
}
