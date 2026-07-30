/**
 * order-history.js — Order history page for CoWork
 *
 * Members: /api/orders/history → sort (newest/oldest) + stall filter + cuisine filter
 * Guests:  localStorage guestOrderHistory → stall filter + cuisine filter,
 *          orders grouped by stall (no time sort).
 *
 * All filtering/sorting is client-side — no API re-fetch.
 */

'use strict';

/* ============================================================
   STATE
============================================================ */

let allOrders = [];           // raw orders from API or localStorage
let isMember = false;         // true when logged in

/* ============================================================
   HELPERS: distinct values from order items
============================================================ */

function collectStallNames(orders) {
  const names = new Set();
  for (const o of orders) {
    for (const item of o.items || []) {
      if (item.stallName) names.add(item.stallName);
    }
  }
  return [...names].sort();
}

function collectCuisineTypes(orders) {
  const types = new Set();
  for (const o of orders) {
    for (const item of o.items || []) {
      if (item.cuisineType) types.add(item.cuisineType);
    }
  }
  return [...types].sort();
}

/**
 * Returns the primary stall name for an order (first item's stallName).
 */
function orderStallName(order) {
  const items = order.items || [];
  return items.length > 0 ? (items[0].stallName || '') : '';
}

/* ============================================================
   RENDER: controls bar
============================================================ */

function renderControls() {
  const row = document.getElementById('controlsRow');
  const bar = document.getElementById('controlsBar');
  if (!row || !bar) return;

  const stallNames = collectStallNames(allOrders);
  const cuisineTypes = collectCuisineTypes(allOrders);

  let html = '';

  // Member-only: sort dropdown
  if (isMember) {
    html += `
      <div class="control-group">
        <label class="control-label" for="sortSelect">Sort</label>
        <select id="sortSelect" class="form-select control-select">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
    `;
  }

  // Stall filter
  html += `
    <div class="control-group">
      <label class="control-label" for="stallFilter">Stall</label>
      <select id="stallFilter" class="form-select control-select">
        <option value="">All Stalls</option>
        ${stallNames.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
      </select>
    </div>
  `;

  // Cuisine filter
  html += `
    <div class="control-group">
      <label class="control-label" for="cuisineFilter">Cuisine</label>
      <select id="cuisineFilter" class="form-select control-select">
        <option value="">All Cuisines</option>
        ${cuisineTypes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </div>
  `;

  row.innerHTML = html;
  bar.style.display = '';

  // Wire events
  if (isMember) {
    document.getElementById('sortSelect').addEventListener('change', renderOrders);
  }
  document.getElementById('stallFilter').addEventListener('change', renderOrders);
  document.getElementById('cuisineFilter').addEventListener('change', renderOrders);
}

/* ============================================================
   FILTER + SORT (in-memory, no network)
============================================================ */

function getFilteredOrders() {
  const stallVal = document.getElementById('stallFilter')?.value || '';
  const cuisineVal = document.getElementById('cuisineFilter')?.value || '';

  let filtered = [...allOrders];

  if (stallVal) {
    filtered = filtered.filter((o) =>
      (o.items || []).some((item) => item.stallName === stallVal)
    );
  }

  if (cuisineVal) {
    filtered = filtered.filter((o) =>
      (o.items || []).some((item) => item.cuisineType === cuisineVal)
    );
  }

  // Member sort
  if (isMember) {
    const sortVal = document.getElementById('sortSelect')?.value || 'newest';
    filtered.sort((a, b) => {
      const da = new Date(a.createdAt || a.orderedAt || 0);
      const db = new Date(b.createdAt || b.orderedAt || 0);
      return sortVal === 'newest' ? db - da : da - db;
    });
  }

  return filtered;
}

/* ============================================================
   RENDER: orders
============================================================ */

function renderOrders() {
  const orderList = document.getElementById('orderList');
  const noMatchState = document.getElementById('noMatchState');
  if (!orderList) return;

  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    orderList.innerHTML = '';
    if (noMatchState) noMatchState.style.display = '';
    return;
  }

  if (noMatchState) noMatchState.style.display = 'none';

  if (isMember) {
    // Flat list
    orderList.innerHTML = filtered.map(renderOrderCard).join('');
  } else {
    // Grouped by stall
    orderList.innerHTML = renderGroupedByStall(filtered);
  }
}

/**
 * Guest view: group orders by primary stall name with stall headings.
 */
function renderGroupedByStall(orders) {
  const groups = new Map();

  for (const o of orders) {
    const stall = orderStallName(o) || 'Unknown Stall';
    if (!groups.has(stall)) groups.set(stall, []);
    groups.get(stall).push(o);
  }

  let html = '';
  for (const [stallName, groupOrders] of groups) {
    html += `
      <div class="stall-order-group">
        <div class="stall-order-heading">
          <h2>${escapeHtml(stallName)}</h2>
          <span class="stall-order-count">${groupOrders.length} order${groupOrders.length !== 1 ? 's' : ''}</span>
        </div>
        ${groupOrders.map(renderOrderCard).join('')}
      </div>
    `;
  }
  return html;
}

/* ============================================================
   RENDER: single order card (shared by member + guest)
============================================================ */

function renderOrderCard(order) {
  const date = new Date(order.createdAt || order.orderedAt);
  const dateStr = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const stallNames = [...new Set((order.items || []).map((i) => i.stallName).filter(Boolean))];

  return `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-card-date">${dateStr}</span>
          ${stallNames.length > 0 ? `<span class="order-card-stall">${stallNames.join(', ')}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="order-card-total">$${Number(order.total).toFixed(2)}</span>
          ${order.status ? `<span class="badge ${statusBadgeClass(order.status)}">${escapeHtml(order.status)}</span>` : ''}
        </div>
      </div>
      <ul class="order-card-items">
        ${(order.items || []).map((item) => `
          <li class="order-card-item">
            <span class="order-item-name">${escapeHtml(item.name)}</span>
            <span class="order-item-qty">x${item.quantity}</span>
            <span class="order-item-price">@ $${Number(item.unitPrice).toFixed(2)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function statusBadgeClass(status) {
  switch (status) {
    case 'Completed': return 'badge-open';
    case 'Paid':      return 'badge-available';
    case 'Pending':   return 'badge-unavailable';
    default:          return '';
  }
}

/* ============================================================
   INIT
============================================================ */

async function loadOrderHistory() {
  const loadingEl = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const controlsBar = document.getElementById('controlsBar');

  isMember = isLoggedIn();

  if (isMember) {
    try {
      const data = await api('/orders/history');
      allOrders = data.orders || [];

      if (isRole('customer')) {
        const card = document.getElementById('customerStatsCard');
        if (card) card.style.display = 'block';

        api('/users/me/stats').then((stats) => {
          const spentEl = document.getElementById('statTotalSpent');
          const listEl = document.getElementById('statTopItemsList');
          if (spentEl) spentEl.textContent = '$' + Number(stats.totalSpent || 0).toFixed(2);
          if (listEl) {
            if (stats.topItems && stats.topItems.length > 0) {
              listEl.innerHTML = stats.topItems
                .map((item) => `<li><strong>${escapeHtml(item.itemName)}</strong> (${item.totalQuantity} ordered)</li>`)
                .join('');
            } else {
              listEl.innerHTML = '<li style="color: var(--text-muted);">No orders yet</li>';
            }
          }
        }).catch((err) => console.error('Failed to load customer stats', err));
      }
    } catch (err) {
      if (loadingEl) loadingEl.textContent = 'Failed to load order history: ' + err.message;
      return;
    }
  } else {
    try {
      const raw = localStorage.getItem('guestOrderHistory');
      allOrders = raw ? JSON.parse(raw) : [];
    } catch {
      allOrders = [];
    }
  }

  if (loadingEl) loadingEl.style.display = 'none';

  if (allOrders.length === 0) {
    if (emptyState) emptyState.style.display = '';
    if (controlsBar) controlsBar.style.display = 'none';
    return;
  }

  renderControls();
  renderOrders();
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  loadOrderHistory();
});
