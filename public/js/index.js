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
const stallReviews = new Map();
const reviewSorts = new Map();

/* ============================================================
   RENDER: filter dropdown
============================================================ */

function renderCuisineFilter() {
  const cuisines = [...new Set(allItems.map((item) => item.CuisineType).filter(Boolean))].sort();
  const select = document.getElementById('cuisineFilter');
  if (!select) return;

  // Keep "All Cuisines" option, append the rest
  select.innerHTML = `<option value="">${t('allCuisines')}</option>` +
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
    container.innerHTML = `<div class="empty-state">${t('noMenuItems')}</div>`;
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
          <span class="stall-rating" id="stall-rating-${group.stallId}">${t('reviewsLoading')}</span>
        </div>
        <div class="menu-grid">
          ${group.items.map(buildItemCard).join('')}
        </div>
        ${buildReviewsPanel(group.stallId)}
      </div>
    `;
  }

  container.innerHTML = html;
  renderLoadedReviews();
}

function buildReviewsPanel(stallId) {
  const sort = reviewSorts.get(stallId) || 'newest';

  return `
    <div class="reviews-panel" id="reviews-panel-${stallId}">
      <div class="reviews-panel-header">
        <h3>${t('ratingsReviews')}</h3>
        <select class="form-select review-sort" data-stall-id="${stallId}" aria-label="Sort reviews">
          <option value="newest"${sort === 'newest' ? ' selected' : ''}>${t('newest')}</option>
          <option value="highest"${sort === 'highest' ? ' selected' : ''}>${t('highestRating')}</option>
        </select>
      </div>
      <div class="reviews-list" id="reviews-list-${stallId}">
        <div class="reviews-empty">${t('loadingReviews')}</div>
      </div>
    </div>
  `;
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
            ${isAvail ? t('available') : t('unavailable')}
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
            ${t('addToCart')}
          </button>
        ` : `
          <div class="qty-stepper disabled-stepper">
            <button type="button" class="qty-btn" disabled>&minus;</button>
            <span class="qty-val">1</span>
            <button type="button" class="qty-btn" disabled>+</button>
          </div>
          <button type="button" class="btn btn-add-cart btn-add-cart--disabled" disabled>
            ${t('unavailable')}
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

  content.addEventListener('change', (e) => {
    const target = e.target;
    if (!target.classList.contains('review-sort')) return;

    const stallId = Number(target.dataset.stallId);
    reviewSorts.set(stallId, target.value);
    loadStallReviews(stallId, target.value);
  });
}

function renderLoadedReviews() {
  for (const [stallId, data] of stallReviews.entries()) {
    renderStallReviews(stallId, data);
  }
}

async function loadAllStallReviews() {
  const stallIds = [...new Set(allItems.map((item) => item.StallId))];
  await Promise.all(stallIds.map((stallId) => loadStallReviews(stallId, reviewSorts.get(stallId) || 'newest')));
}

async function loadStallReviews(stallId, sort) {
  const listEl = document.getElementById(`reviews-list-${stallId}`);
  if (listEl) {
    listEl.innerHTML = `<div class="reviews-empty">${t('loadingReviews')}</div>`;
  }

  try {
    const data = await api(`/stalls/${stallId}/reviews?sort=${encodeURIComponent(sort)}`);
    stallReviews.set(stallId, data);
    renderStallReviews(stallId, data);
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div class="reviews-empty">${t('failedReviews')}: ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderStallReviews(stallId, data) {
  const ratingEl = document.getElementById(`stall-rating-${stallId}`);
  const listEl = document.getElementById(`reviews-list-${stallId}`);
  const summary = data.summary || {};
  const reviews = data.reviews || [];
  const reviewCount = Number(summary.ReviewCount || 0);
  const average = Number(summary.AverageRating || 0);

  if (ratingEl) {
    ratingEl.textContent = reviewCount > 0
      ? `${average.toFixed(1)} / 5 (${reviewCount} ${t(reviewCount === 1 ? 'review' : 'reviews')})`
      : t('noReviews');
  }

  if (!listEl) return;

  if (reviews.length === 0) {
    listEl.innerHTML = `<div class="reviews-empty">${t('noReviews')}</div>`;
    return;
  }

  listEl.innerHTML = reviews.map((review) => {
    const date = review.CreatedAt ? new Date(review.CreatedAt).toLocaleDateString() : '';
    return `
      <article class="review-item">
        <div class="review-item-header">
          <strong>${escapeHtml(review.Username || t('customer'))}</strong>
          <span>${escapeHtml(String(review.Rating))} / 5</span>
        </div>
        <p>${escapeHtml(review.Comment)}</p>
        ${date ? `<div class="review-date">${escapeHtml(date)}</div>` : ''}
      </article>
    `;
  }).join('');
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
  buttonEl.textContent = `${t('added')} \u2713`;
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
      content.innerHTML = `<div class="empty-state">${t('failedMenu')}</div>`;
    }
    return;
  }

  renderCuisineFilter();
  applyTranslations();
  renderMenu();
  attachMenuEvents();
  loadAllStallReviews();
}

document.addEventListener('DOMContentLoaded', init);
