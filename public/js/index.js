/**
 * index.js — Home page: menu browsing, cuisine filter, add-to-cart
 *
 * Reads /api/menu, renders items grouped by stall, and writes to
 * localStorage key "freshbite_cart" in the exact shape that cart.js
 * expects: [{ menuItemId, quantity, specialInstructions }].
 */

'use strict';

/* ============================================================
   CART HELPERS — mirrors addToCart() logic in cart.js
============================================================ */

const CART_KEY = 'freshbite_cart';

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/**
 * addToCartLocal(menuItemId, quantity)
 * Same merge semantics as cart.js addToCart():
 *   - existing item → increase quantity
 *   - new item     → push { menuItemId, quantity, specialInstructions: "" }
 */
function addToCartLocal(menuItemId, quantity) {
  const cart = readCart();
  const existing = cart.find((item) => item.menuItemId === menuItemId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ menuItemId, quantity, specialInstructions: '' });
  }

  writeCart(cart);
}

/* ============================================================
   STATE
============================================================ */

let allItems = [];       // raw items from API (PascalCase columns)

/* ============================================================
   RENDER: filter dropdown
============================================================ */

function renderCuisineFilter() {
  const cuisines = [...new Set(allItems.map((item) => item.CuisineType).filter(Boolean))].sort();
  const select = document.getElementById('cuisineFilter');
  if (!select) return;

  // Keep "All Cuisines" option, append the rest
  select.innerHTML = '<option value="">All Cuisines</option>' +
    cuisines.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  select.addEventListener('change', renderMenu);
}

/* ============================================================
   RENDER: menu grouped by stall
============================================================ */

function getFilteredItems() {
  const cuisine = document.getElementById('cuisineFilter')?.value || '';
  if (!cuisine) return allItems;
  return allItems.filter((item) => item.CuisineType === cuisine);
}

function renderMenu() {
  const container = document.getElementById('menuContent');
  if (!container) return;

  const filtered = getFilteredItems();

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No menu items found.</div>';
    return;
  }

  // Group by stallId
  const groups = new Map();
  for (const item of filtered) {
    const stallId = item.StallId;
    if (!groups.has(stallId)) {
      groups.set(stallId, {
        stallId,
        stallName: item.StallName,
        cuisineType: item.CuisineType,
        items: [],
      });
    }
    groups.get(stallId).items.push(item);
  }

  let html = '';
  for (const [, group] of groups) {
    html += `
      <div class="stall-group">
        <div class="stall-heading">
          <h2>${escapeHtml(group.stallName)}</h2>
          <span class="badge cuisine-badge">${escapeHtml(group.cuisineType)}</span>
        </div>
        <div class="menu-grid">
          ${group.items.map(buildItemCard).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function buildItemCard(item) {
  const isAvail = !!item.IsAvailable;
  const price = Number(item.Price).toFixed(2);

  return `
    <div class="menu-card${isAvail ? '' : ' menu-card--unavailable'}">
      <div class="menu-card-body">
        <div class="menu-card-header">
          <h3 class="menu-card-name">${escapeHtml(item.Name)}</h3>
          <span class="badge ${isAvail ? 'badge-available' : 'badge-unavailable'}">
            ${isAvail ? 'Available' : 'Unavailable'}
          </span>
        </div>
        ${item.Description ? `<p class="menu-card-desc">${escapeHtml(item.Description)}</p>` : ''}
        <div class="menu-card-meta">
          <span class="menu-card-price">$${price}</span>
          <button type="button" class="menu-card-likes btn-like" data-like-id="${item.MenuItemId}" title="${item.LikeCount} likes">
            &#9829; <span id="likes-${item.MenuItemId}">${item.LikeCount}</span>
          </button>
        </div>
      </div>
      <div class="menu-card-actions">
        ${isAvail ? `
          <div class="qty-stepper" data-item-id="${item.MenuItemId}">
            <button type="button" class="qty-btn qty-dec" data-item-id="${item.MenuItemId}" aria-label="Decrease quantity">&minus;</button>
            <span class="qty-val" id="qty-${item.MenuItemId}">1</span>
            <button type="button" class="qty-btn qty-inc" data-item-id="${item.MenuItemId}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn-primary btn-add-cart" data-item-id="${item.MenuItemId}">
            Add to cart
          </button>
        ` : `
          <div class="qty-stepper disabled-stepper">
            <button type="button" class="qty-btn" disabled>&minus;</button>
            <span class="qty-val">1</span>
            <button type="button" class="qty-btn" disabled>+</button>
          </div>
          <button type="button" class="btn btn-add-cart btn-add-cart--disabled" disabled>
            Unavailable
          </button>
        `}
      </div>
    </div>
  `;
}

/* ============================================================
   EVENT HANDLERS
============================================================ */

function attachMenuEvents() {
  const content = document.getElementById('menuContent');
  if (!content) return;

  content.addEventListener('click', (e) => {
    const target = e.target;
    const likeButton = target.closest('.btn-like');

    if (likeButton) {
      handleLike(Number(likeButton.dataset.likeId), likeButton);
      return;
    }

    const itemId = Number(target.dataset.itemId);
    if (!itemId) return;

    // Quantity stepper
    if (target.classList.contains('qty-inc')) {
      changeQty(itemId, 1);
    } else if (target.classList.contains('qty-dec')) {
      changeQty(itemId, -1);
    }

    // Add to cart button
    if (target.classList.contains('btn-add-cart')) {
      handleAddToCart(itemId, target);
    }
  });
}

async function handleLike(menuItemId, buttonEl) {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return;
  }

  if (!isRole('customer')) {
    buttonEl.title = 'Only customers can like menu items';
    return;
  }

  buttonEl.disabled = true;

  try {
    const data = await api(`/menu/${menuItemId}/like`, { method: 'POST' });
    const likeCount = data.item?.LikeCount;
    const countEl = document.getElementById(`likes-${menuItemId}`);

    if (countEl && likeCount !== undefined) {
      countEl.textContent = likeCount;
    }

    buttonEl.classList.add('btn-like--liked');
    buttonEl.title = data.message || 'Liked';

    const item = allItems.find((entry) => entry.MenuItemId === menuItemId);
    if (item && likeCount !== undefined) {
      item.LikeCount = likeCount;
    }
  } catch (err) {
    buttonEl.title = err.message;
  } finally {
    buttonEl.disabled = false;
  }
}

function changeQty(itemId, delta) {
  const span = document.getElementById(`qty-${itemId}`);
  if (!span) return;
  let val = parseInt(span.textContent, 10) || 1;
  val = Math.max(1, val + delta);
  span.textContent = val;
}

function handleAddToCart(menuItemId, buttonEl) {
  // Read current qty from the stepper
  const qtySpan = document.getElementById(`qty-${menuItemId}`);
  const qty = qtySpan ? Math.max(1, parseInt(qtySpan.textContent, 10) || 1) : 1;

  // Write to localStorage (merge logic)
  addToCartLocal(menuItemId, qty);

  // Visual confirmation
  const originalText = buttonEl.textContent;
  buttonEl.textContent = 'Added \u2713';
  buttonEl.classList.add('btn-add-cart--confirmed');
  buttonEl.disabled = true;

  setTimeout(() => {
    buttonEl.textContent = originalText;
    buttonEl.classList.remove('btn-add-cart--confirmed');
    buttonEl.disabled = false;
  }, 1500);

  // Update cart badge in navbar
  updateCartBadge();
}

/* ============================================================
   INIT
============================================================ */

async function init() {
  renderNavbar();

  const content = document.getElementById('menuContent');

  try {
    const data = await api('/menu');
    allItems = data.items || [];
  } catch (err) {
    console.error('Failed to load menu:', err);
    if (content) {
      content.innerHTML = '<div class="empty-state">Failed to load menu. Please try again later.</div>';
    }
    return;
  }

  renderCuisineFilter();
  renderMenu();
  attachMenuEvents();
}

document.addEventListener('DOMContentLoaded', init);
