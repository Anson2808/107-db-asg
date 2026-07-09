/**
 * order-history.js — Order history page for CoWork
 * Logged-in users fetch from /api/orders/history.
 * Guest users read from localStorage key "guestOrderHistory".
 */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
  loadOrderHistory();
});

async function loadOrderHistory() {
  const loadingEl = document.getElementById("loadingState");
  const orderList = document.getElementById("orderList");
  const emptyState = document.getElementById("emptyState");

  let orders = [];

  if (isLoggedIn()) {
    try {
      const data = await api("/orders/history");
      orders = data.orders || [];
    } catch (err) {
      loadingEl.textContent = "Failed to load order history: " + err.message;
      return;
    }
  } else {
    // Guest — read from localStorage
    try {
      const raw = localStorage.getItem("guestOrderHistory");
      orders = raw ? JSON.parse(raw) : [];
    } catch {
      orders = [];
    }
  }

  loadingEl.style.display = "none";

  if (orders.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  orderList.innerHTML = orders.map(renderOrderCard).join("");
}

function renderOrderCard(order) {
  const date = new Date(order.createdAt || order.orderedAt);
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const stallNames = [...new Set(order.items.map((i) => i.stallName).filter(Boolean))];

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-card-date">${dateStr}</span>
          ${stallNames.length > 0 ? `<span class="order-card-stall">${stallNames.join(", ")}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="order-card-total">$${Number(order.total).toFixed(2)}</span>
          ${order.status ? `<span class="badge ${order.status === "Completed" ? "badge-open" : order.status === "Paid" ? "badge-available" : order.status === "Pending" ? "badge-unavailable" : ""}">${order.status}</span>` : ""}
        </div>
      </div>
      <ul class="order-card-items">
        ${order.items.map((item) => `
          <li class="order-card-item">
            <span class="order-item-name">${escapeHtml(item.name)}</span>
            <span class="order-item-qty">x${item.quantity}</span>
            <span class="order-item-price">@ $${Number(item.unitPrice).toFixed(2)}</span>
          </li>
        `).join("")}
      </ul>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
