/* ============================================================
   cart.js — Checkout review page (cart.html)
   ------------------------------------------------------------
   The cart lives in the DATABASE (CartItems table) and is read
   and mutated through the REST API (/api/cart). This page shows
   the logged-in user's cart, lets them adjust quantities or
   remove lines, previews the order totals, and hands off to
   payment.html to actually place the order.

   Prices are never stored on cart lines — they are always looked
   up live from /api/menu. The totals below are a DISPLAY preview
   only; the backend recalculates everything from live prices at
   order time (models/orderModel.js) and trusts nothing from here.
   ============================================================ */

'use strict';

/* ============================================================
   CONFIG — display constants (must mirror models/orderModel.js)
============================================================ */
const CART_CONFIG = Object.freeze({
  GST_RATE: 0.09,                      // 9% GST, display preview only
  PACKAGING_FEE: 0.60,                 // flat fee, mirrors Orders.PackagingFee
  DELIVERY_FEE: 2.50,                  // flat fee, mirrors Orders.DeliveryFee
  MIN_QUANTITY: 1                      // below this, the line is removed instead
});

// Images are intentionally used only in the cart. Keys match MenuItemId values
// from database/seed.sql, so a selected cart item always receives its own photo.
const MENU_IMAGE_PATHS = Object.freeze({
  1: "/menu_image/rotijohnclassic.jpg",
  2: "/menu_image/chickenrotijohn.jpeg",
  3: "/menu_image/cheeserotijohn.jpeg",
  4: "/menu_image/muttonkebabwrap.jpg",
  5: "/menu_image/currypuff.jpg",
  6: "/menu_image/tehtarik.jpg",
  7: "/menu_image/charkwayteow.jpg",
  8: "/menu_image/hokkienmee.jpg",
  9: "/menu_image/sweetandsourchickenrice.jpg",
  10: "/menu_image/wontonnoodlesoup.jpg",
  11: "/menu_image/springroll.jpg",
  12: "/menu_image/icelemontea.jpg",
  13: "/menu_image/chickenbiryani.jpg",
  14: "/menu_image/butterchicken.jpg",
  15: "/menu_image/garlicnaan.jpg",
  16: "/menu_image/vegetablesamosa.jpg",
  17: "/menu_image/mangolassi.jpg",
  18: "/menu_image/masalachai.jpg",
});

/* ============================================================
   IN-MEMORY STATE
============================================================ */

/**
 * cartItems — the user's cart rows as returned by GET /api/cart:
 * [{ cartItemId, menuItemId, name, stallName, unitPrice, quantity, lineTotal }]
 */
let cartItems = [];

/**
 * menuItemsCache — /api/menu items mapped to camelCase:
 * [{ menuItemId, stallId, stallName, name, description, price, isAvailable }]
 */
let menuItemsCache = [];

/* ============================================================
   API LAYER
============================================================ */

/**
 * GET /api/menu — maps DB column casing (MenuItemId, Name, ...)
 * to the camelCase shape the rest of this file expects.
 */
async function fetchMenuItems() {
  const data = await api('/menu');

  return (data.items || []).map((item) => ({
    menuItemId: item.MenuItemId,
    stallId: item.StallId,
    stallName: item.StallName,
    name: item.Name,
    description: item.Description || '',
    price: Number(item.Price),
    isAvailable: !!item.IsAvailable
  }));
}

/**
 * GET /api/cart — fetches user's cart from database.
 */
async function fetchCart() {
  try {
    const res = await api('/cart');
    cartItems = res.cart || [];
  } catch (error) {
    console.error('Failed to fetch cart:', error);
    cartItems = [];
  }
}

/* ============================================================
   CART MUTATION FUNCTIONS
============================================================ */

/**
 * removeFromCart(menuItemId)
 * Removes a single cart line entirely from the database.
 */
async function removeFromCart(menuItemId) {
  const item = cartItems.find((c) => c.menuItemId === menuItemId);
  if (!item) {
    console.error(`removeFromCart failed: menuItemId ${menuItemId} not in cart`);
    return;
  }
  try {
    await api(`/cart/${item.cartItemId}`, { method: 'DELETE' });
    await fetchCart();
    renderCart();
    await updateCartBadge();
  } catch (error) {
    console.error('removeFromCart failed:', error);
    alert(error.message || 'Failed to remove item from cart');
  }
}

/**
 * updateQuantity(menuItemId, delta)
 * Increases or decreases a cart line's quantity in the database.
 */
async function updateQuantity(menuItemId, delta) {
  const item = cartItems.find((c) => c.menuItemId === menuItemId);
  if (!item) {
    console.error(`updateQuantity failed: menuItemId ${menuItemId} not in cart`);
    return;
  }

  const newQty = item.quantity + delta;
  if (newQty < CART_CONFIG.MIN_QUANTITY) {
    await removeFromCart(menuItemId);
    return;
  }

  try {
    await api(`/cart/${item.cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: newQty })
    });
    await fetchCart();
    renderCart();
    await updateCartBadge();
  } catch (error) {
    console.error('updateQuantity failed:', error);
    alert(error.message || 'Failed to update quantity');
  }
}

/* ============================================================
   MENU ITEM LOOKUP HELPERS
============================================================ */

/**
 * getMenuItemById(menuItemId)
 * Looks up a menu item's live details (name, price, stall,
 * availability) from the cache populated by fetchMenuItems().
 * Cart lines never store this data themselves.
 */
function getMenuItemById(menuItemId) {
  return menuItemsCache.find((item) => item.menuItemId === menuItemId) || null;
}

function getMenuItemImage(menuItemId) {
  return MENU_IMAGE_PATHS[menuItemId] || "/menu_image/menu.jpeg";
}

/* ============================================================
   TOTALS CALCULATION
============================================================ */

/**
 * calculateTotals()
 * Computes the display preview of Subtotal, PackagingFee,
 * DeliveryFee, GST and Grand Total for the current cart.
 * The backend recomputes all of these at order time.
 */
function calculateTotals() {
  const isCartEmpty = cartItems.length === 0;

  const subtotal = cartItems.reduce((sum, cartItem) => {
    const menuItem = getMenuItemById(cartItem.menuItemId);
    const price = menuItem ? menuItem.price : 0;
    return sum + price * cartItem.quantity;
  }, 0);

  // Flat fees only apply when there is something to deliver
  const packagingFee = isCartEmpty ? 0 : CART_CONFIG.PACKAGING_FEE;
  const deliveryFee = isCartEmpty ? 0 : CART_CONFIG.DELIVERY_FEE;

  const gst = subtotal * CART_CONFIG.GST_RATE;
  const grandTotal = subtotal + packagingFee + deliveryFee + gst;

  return {
    subtotal: roundToCents(subtotal),
    packagingFee: roundToCents(packagingFee),
    deliveryFee: roundToCents(deliveryFee),
    gst: roundToCents(gst),
    grandTotal: roundToCents(grandTotal)
  };
}

/**
 * roundToCents(value)
 * Rounds a floating point currency value to 2 decimal places,
 * avoiding common floating-point rounding artifacts.
 */
function roundToCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ============================================================
   CHECKOUT VALIDATION
============================================================ */

/**
 * validateCheckout()
 * Determines whether the "Place Order" button should be
 * enabled. Returns true only if the cart has at least one item
 * and every item currently in the cart is still available.
 */
function validateCheckout() {
  if (cartItems.length === 0) {
    return false;
  }

  return cartItems.every((cartItem) => {
    const menuItem = getMenuItemById(cartItem.menuItemId);
    return menuItem && menuItem.isAvailable;
  });
}

/* ============================================================
   RENDERING
   ------------------------------------------------------------
   Assumes the following elements exist in cart.html:
     <ul class="cart-item-list">                 — cart container
     <dd id="summarySubtotal">                   — order summary
     <dd id="summaryPackagingFee">
     <dd id="summaryDeliveryFee">
     <dd id="summaryGST">
     <dd id="summaryGrandTotal">
     <button class="place-order-btn">            — payment handoff
============================================================ */

/**
 * renderCart()
 * Re-renders the entire cart list and order summary based on
 * the current in-memory cartItems + menuItemsCache. Also
 * updates the Place Order button's enabled/disabled state.
 */
function renderCart() {
  const cartListElement = document.querySelector('.cart-item-list');

  if (!cartListElement) {
    console.error('renderCart failed: .cart-item-list element not found in the DOM.');
    return;
  }

  if (cartItems.length === 0) {
    showEmptyCart();
  } else {
    cartListElement.innerHTML = cartItems.map(buildCartItemMarkup).join('');
  }

  renderOrderSummary();
  updatePlaceOrderButtonState();
}

/**
 * buildCartItemMarkup(cartItem)
 * Builds the HTML string for a single cart line item.
 */
function buildCartItemMarkup(cartItem) {
  const menuItem = getMenuItemById(cartItem.menuItemId);

  if (!menuItem) {
    console.warn(`buildCartItemMarkup: MenuItemId ${cartItem.menuItemId} not found in menuItemsCache!`, { cartItem, menuItemsCache });
    return '';
  }

  const lineTotal = roundToCents(menuItem.price * cartItem.quantity);

  return `
    <li class="cart-item" data-item-id="${menuItem.menuItemId}">
      <div class="cart-item-image">
        <img src="${getMenuItemImage(menuItem.menuItemId)}" alt="${menuItem.name}" onerror="this.src='/menu_image/menu.jpeg'">
      </div>
      <div class="cart-item-details">
        <h3 class="cart-item-name">${menuItem.name}</h3>
        <p class="cart-item-vendor">Sold by: ${menuItem.stallName}</p>
        <p class="cart-item-description">${menuItem.description}</p>
      </div>
      <div class="cart-item-controls">
        <div class="quantity-selector" data-item-id="${menuItem.menuItemId}">
          <button type="button" class="qty-btn qty-decrease" data-item-id="${menuItem.menuItemId}" aria-label="Decrease quantity">−</button>
          <span class="qty-value">${cartItem.quantity}</span>
          <button type="button" class="qty-btn qty-increase" data-item-id="${menuItem.menuItemId}" aria-label="Increase quantity">+</button>
        </div>
        <p class="cart-item-price" data-price="${menuItem.price}">$${lineTotal.toFixed(2)}</p>
        <button type="button" class="remove-item-btn" data-item-id="${menuItem.menuItemId}">Remove</button>
      </div>
    </li>
  `;
}

/**
 * showEmptyCart()
 * Displays a friendly empty-cart message inside the cart list
 * container.
 */
function showEmptyCart() {
  const cartListElement = document.querySelector('.cart-item-list');

  if (!cartListElement) {
    return;
  }

  cartListElement.innerHTML = `
    <li class="cart-empty-message">
      Your cart is empty. Browse the menu to add something delicious!
    </li>
  `;
}

/**
 * renderOrderSummary()
 * Recalculates totals and writes them into the order summary
 * DOM elements.
 */
function renderOrderSummary() {
  const totals = calculateTotals();

  setTextIfExists('summarySubtotal', formatCurrency(totals.subtotal));
  setTextIfExists('summaryPackagingFee', formatCurrency(totals.packagingFee));
  setTextIfExists('summaryDeliveryFee', formatCurrency(totals.deliveryFee));
  setTextIfExists('summaryGST', formatCurrency(totals.gst));
  setTextIfExists('summaryGrandTotal', formatCurrency(totals.grandTotal));
}

/**
 * updatePlaceOrderButtonState()
 * Enables or disables the Place Order button based on
 * validateCheckout().
 */
function updatePlaceOrderButtonState() {
  const placeOrderButton = document.querySelector('.place-order-btn');

  if (!placeOrderButton) {
    return;
  }

  placeOrderButton.disabled = !validateCheckout();
}

/**
 * setTextIfExists(elementId, text)
 * Small DOM helper — safely sets textContent only if the
 * target element is present, avoiding repeated null checks.
 */
function setTextIfExists(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * formatCurrency(amount)
 * Formats a number as a currency string, e.g. 8.5 -> "$8.50".
 */
function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

/* ============================================================
   EVENT DELEGATION
   ------------------------------------------------------------
   A single set of listeners on the cart container handles all
   quantity/remove button clicks, since cart items are
   re-rendered dynamically.
============================================================ */

function attachCartEventListeners() {
  const cartListElement = document.querySelector('.cart-item-list');

  if (cartListElement) {
    cartListElement.addEventListener('click', (event) => {
      const target = event.target;
      const menuItemId = Number(target.dataset.itemId);

      if (!menuItemId) {
        return;
      }

      if (target.classList.contains('qty-increase')) {
        updateQuantity(menuItemId, 1);
      } else if (target.classList.contains('qty-decrease')) {
        updateQuantity(menuItemId, -1);
      } else if (target.classList.contains('remove-item-btn')) {
        removeFromCart(menuItemId);
      }
    });
  }

  const placeOrderButton = document.querySelector('.place-order-btn');

  if (placeOrderButton) {
    placeOrderButton.addEventListener('click', () => {
      if (validateCheckout()) {
        window.location.href = '/payment.html';
      }
    });
  }
}

/* ============================================================
   INITIALIZATION
============================================================ */

/**
 * initCart()
 * Entry point — requires login, loads the menu cache and the
 * user's cart from the API, then renders and wires up events.
 */
async function initCart() {
  if (!isLoggedIn()) {
    window.location.href = '/login.html';
    return;
  }

  try {
    menuItemsCache = await fetchMenuItems();
    await fetchCart();
  } catch (error) {
    console.error('Failed to initialize cart page.', error);
    menuItemsCache = [];
    cartItems = [];
  }

  renderCart();
  attachCartEventListeners();
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  initCart();
});
