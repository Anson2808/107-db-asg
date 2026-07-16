/* ============================================================
   FRESHBITE / COWORK — SHOPPING CART LOGIC (FRONTEND ONLY)
   ------------------------------------------------------------
   Maps directly to the SQL Server schema provided:
     - dbo.CartItems  (CartItemId, UserId, MenuItemId, Quantity)
     - dbo.MenuItems  (MenuItemId, StallId, Name, Description,
                       Price, IsAvailable, LikeCount)
     - dbo.Stalls     (StallId, StallName, ...)
     - dbo.Orders     (Subtotal, PackagingFee, DeliveryFee, Total)
     - dbo.OrderItems (OrderId, MenuItemId, StallId, ItemName,
                       UnitPrice, Quantity)
     - dbo.Payments   (OrderId, Amount, Method, Status)

   IMPORTANT SCHEMA NOTES (flagged, not invented):
     1. CartItems has NO price column — price is always looked
        up live from MenuItems.Price. Never cache price on the
        cart item itself.
     2. Orders has NO GST or Discount column. Per instructions,
        GST is calculated here in the frontend only (9%, not
        persisted). Discount logic is intentionally skipped —
        no PromoCodes table exists in the schema.
     3. PackagingFee / DeliveryFee ARE persisted columns on
        Orders, but there is no config table for their values.
        Per instructions, fixed flat constants are used for now.
     4. "Special instructions" per cart item has no backing
        column in CartItems. It is kept as a local, UI-only
        field (not sent to saveCartToAPI) until the schema is
        extended to support it — flagged with TODO below.
   ============================================================ */

'use strict';

/* ============================================================
   CONFIG — business constants (frontend-only, per instructions)
============================================================ */
const CART_CONFIG = Object.freeze({
  STORAGE_KEY: 'freshbite_cart',       // localStorage key for CartItems mirror
  GST_RATE: 0.09,                      // 9% GST, calculated client-side only
  PACKAGING_FEE: 0.60,                 // flat fee, mirrors Orders.PackagingFee
  DELIVERY_FEE: 2.50,                  // flat fee, mirrors Orders.DeliveryFee
  MIN_QUANTITY: 1                      // quantity can never drop below this
});

/* ============================================================
   IN-MEMORY STATE
============================================================ */

/**
 * cartItems mirrors dbo.CartItems rows for the current user.
 * Each entry: { menuItemId, quantity, specialInstructions }
 * NOTE: UserId is intentionally omitted here — it will be
 * attached server-side from the authenticated session once
 * saveCartToAPI() is implemented.
 * NOTE: specialInstructions is UI-only (see schema note #4).
 */
let cartItems = [];

/**
 * menuItemsCache mirrors a MenuItems + Stalls join.
 * Populated by fetchMenuItems() (mock for now).
 * Each entry: { menuItemId, stallId, stallName, name,
 *               description, price, isAvailable }
 */
let menuItemsCache = [];

/* ============================================================
   MOCK API LAYER
   ------------------------------------------------------------
   These functions simulate the future Express + SQL Server
   REST endpoints. They return Promises so the calling code
   already behaves exactly as it will once real fetch() calls
   replace the mock data below.
============================================================ */

/**
 * GET /api/menu — real endpoint.
 * Runs: SELECT MenuItems.*, Stalls.StallName, Stalls.CuisineType
 *       FROM MenuItems JOIN Stalls ON MenuItems.StallId = Stalls.StallId
 * Maps DB column casing (MenuItemId, Name, ...) to the camelCase
 * shape the rest of this file expects.
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
 * Mock GET /api/cart?userId=...
 * Simulates: SELECT * FROM CartItems WHERE UserId = @userId
 * TODO: Replace with a real fetch(`/api/cart/${userId}`) call
 *       once the Express route + SQL Server query exist.
 */
async function getCartFromAPI(userId) {
  await mockDelay(150);
  // TODO: implement real GET request to Express API
  // TODO: Express route should run:
  //   SELECT CartItemId, MenuItemId, Quantity FROM CartItems WHERE UserId = @userId
  console.warn('getCartFromAPI() is a placeholder — no backend connected yet.', { userId });
  return [];
}

/**
 * Mock POST/PUT /api/cart
 * Simulates: MERGE/UPSERT into CartItems (UserId, MenuItemId, Quantity)
 * TODO: Replace with a real fetch('/api/cart', { method: 'POST', ... })
 *       call once the Express route + SQL Server query exist.
 */
async function saveCartToAPI(userId, items) {
  await mockDelay(150);
  // TODO: implement real POST/PUT request to Express API
  // TODO: Express route should upsert into CartItems per
  //   (UserId, MenuItemId) using UQ_Cart_User_Item constraint
  console.warn('saveCartToAPI() is a placeholder — no backend connected yet.', { userId, items });
  return { success: true };
}

/**
 * POST /api/orders — real endpoint.
 * Sends { items, paymentMethod } — the server looks up live
 * prices itself and recalculates every total; nothing priced
 * here is trusted from the client.
 */
async function createOrder(orderPayload) {
  return api("/orders", {
    method: "POST",
    body: JSON.stringify(orderPayload),
  });
}

/**
 * Small helper to simulate network latency in mock functions.
 */
function mockDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ============================================================
   LOCAL STORAGE PERSISTENCE
============================================================ */

/**
 * loadCart()
 * Reads the cart from localStorage into the in-memory cartItems
 * array. Falls back to an empty cart if nothing is stored or
 * the stored data is corrupted.
 */
function loadCart() {
  try {
    const rawCart = localStorage.getItem(CART_CONFIG.STORAGE_KEY);
    cartItems = rawCart ? JSON.parse(rawCart) : [];
  } catch (error) {
    console.error('Failed to load cart from localStorage. Resetting cart.', error);
    cartItems = [];
  }
  return cartItems;
}

/**
 * saveCart()
 * Persists the in-memory cartItems array into localStorage.
 */
function saveCart() {
  try {
    localStorage.setItem(CART_CONFIG.STORAGE_KEY, JSON.stringify(cartItems));
  } catch (error) {
    console.error('Failed to save cart to localStorage.', error);
  }
}

/**
 * clearCart()
 * Empties the cart both in memory and in localStorage, then
 * re-renders the UI to reflect the empty state.
 */
function clearCart() {
  cartItems = [];
  saveCart();
  renderCart();
}

/* ============================================================
   CART MUTATION FUNCTIONS
============================================================ */

/**
 * addToCart(menuItemId, quantity, specialInstructions)
 * Adds a menu item to the cart. If it already exists, increases
 * its quantity instead of creating a duplicate row (mirrors the
 * UQ_Cart_User_Item unique constraint on CartItems).
 */
function addToCart(menuItemId, quantity = 1, specialInstructions = '') {
  const menuItem = getMenuItemById(menuItemId);

  if (!menuItem) {
    console.error(`addToCart failed: MenuItemId ${menuItemId} not found in menuItemsCache.`);
    return;
  }

  if (!menuItem.isAvailable) {
    console.warn(`addToCart blocked: "${menuItem.name}" is currently unavailable.`);
    return;
  }

  const existingItem = cartItems.find((item) => item.menuItemId === menuItemId);

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cartItems.push({
      menuItemId,
      quantity: Math.max(quantity, CART_CONFIG.MIN_QUANTITY),
      specialInstructions // UI-only field, see schema note #4
    });
  }

  saveCart();
  renderCart();
}

/**
 * removeFromCart(menuItemId)
 * Removes a single cart line entirely, regardless of quantity.
 */
function removeFromCart(menuItemId) {
  cartItems = cartItems.filter((item) => item.menuItemId !== menuItemId);
  saveCart();
  renderCart();
}

/**
 * updateQuantity(menuItemId, delta)
 * Increases or decreases a cart line's quantity by `delta`
 * (typically +1 or -1). Quantity is never allowed to drop
 * below CART_CONFIG.MIN_QUANTITY — use removeFromCart() to
 * delete a line entirely.
 */
function updateQuantity(menuItemId, delta) {
  const cartItem = cartItems.find((item) => item.menuItemId === menuItemId);

  if (!cartItem) {
    console.error(`updateQuantity failed: MenuItemId ${menuItemId} not in cart.`);
    return;
  }

  const nextQuantity = cartItem.quantity + delta;

  // Prevent quantity below the configured minimum
  cartItem.quantity = Math.max(nextQuantity, CART_CONFIG.MIN_QUANTITY);

  saveCart();
  renderCart();
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

/* ============================================================
   TOTALS CALCULATION
============================================================ */

/**
 * calculateTotals()
 * Computes Subtotal, PackagingFee, DeliveryFee, GST, Discount,
 * and Grand Total for the current cart.
 *
 * Field names in the returned object intentionally match the
 * Orders table columns (Subtotal, PackagingFee, DeliveryFee,
 * Total) so the object can later be sent almost as-is to
 * createOrder(). GST and Discount are NOT Orders columns —
 * they exist here only as frontend display values.
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

  // GST calculated client-side only — no Orders column exists for it
  const gst = subtotal * CART_CONFIG.GST_RATE;

  // Discount intentionally skipped — no PromoCodes table exists yet
  const discount = 0;

  const grandTotal = subtotal + packagingFee + deliveryFee + gst - discount;

  return {
    subtotal: roundToCents(subtotal),
    packagingFee: roundToCents(packagingFee),
    deliveryFee: roundToCents(deliveryFee),
    gst: roundToCents(gst),
    discount: roundToCents(discount),
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

/**
 * placeOrder(paymentMethod)
 * Builds the { items, paymentMethod } payload the real API
 * expects, calls createOrder(), and on success clears the cart
 * and redirects to the order history page.
 */
async function placeOrder(paymentMethod) {
  if (!validateCheckout()) {
    return { success: false, message: 'Your cart is empty or contains an unavailable item.' };
  }

  const items = cartItems.map((cartItem) => ({
    menuItemId: cartItem.menuItemId,
    quantity: cartItem.quantity
  }));

  try {
    const { order } = await createOrder({ items, paymentMethod });
    clearCart(); // empties localStorage cart now that the order is placed
    return { success: true, order };
  } catch (error) {
    console.error('placeOrder failed.', error);
    return { success: false, message: error.message || 'Failed to place order.' };
  }
}

/* ============================================================
   TEMPORARY ORDER SUMMARY (for handoff to createOrder later)
============================================================ */

/**
 * generateOrderSummary()
 * Builds a temporary summary object shaped to match Orders +
 * OrderItems columns, ready to be passed into createOrder()
 * once the real Express endpoint exists. This does NOT persist
 * anything yet — it is purely a client-side preview/payload.
 */
function generateOrderSummary() {
  const totals = calculateTotals();

  const orderItems = cartItems.map((cartItem) => {
    const menuItem = getMenuItemById(cartItem.menuItemId);
    return {
      menuItemId: cartItem.menuItemId,
      stallId: menuItem ? menuItem.stallId : null,
      itemName: menuItem ? menuItem.name : 'Unknown Item',
      unitPrice: menuItem ? menuItem.price : 0,
      quantity: cartItem.quantity,
      specialInstructions: cartItem.specialInstructions || '' // UI-only, not in OrderItems schema
    };
  });

  return {
    subtotal: totals.subtotal,
    packagingFee: totals.packagingFee,
    deliveryFee: totals.deliveryFee,
    total: totals.grandTotal, // maps to Orders.Total
    status: 'Pending',        // matches Orders.Status default
    items: orderItems
  };
}

/* ============================================================
   RENDERING
   ------------------------------------------------------------
   Assumes the following elements exist in the HTML:
     <ul class="cart-item-list">                — cart container
     <p id="summarySubtotal">                    — order summary
     <p id="summaryPackagingFee">
     <p id="summaryDeliveryFee">
     <p id="summaryGST">
     <p id="summaryDiscount">
     <p id="summaryGrandTotal">
     <button class="place-order-btn">            — checkout button
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
    return '';
  }

  const lineTotal = roundToCents(menuItem.price * cartItem.quantity);

  return `
    <li class="cart-item" data-item-id="${menuItem.menuItemId}">
      <div class="cart-item-image">
        <img src="assets/food-placeholder.jpg" alt="${menuItem.name}">
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
  setTextIfExists('summaryDiscount', totals.discount > 0 ? `−${formatCurrency(totals.discount)}` : formatCurrency(0));
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
  const messageElement = document.querySelector('.place-order-message');

  if (placeOrderButton) {
    placeOrderButton.addEventListener('click', () => {
      if (validateCheckout()) {
        window.location.href = '/payment.html';
      }
    });
  }

  const cancelOrderButton = document.querySelector('.cancel-order-btn');

  if (cancelOrderButton) {
    cancelOrderButton.addEventListener('click', () => {
      clearCart();
      if (messageElement) {
        messageElement.textContent = '';
      }
    });
  }
}

/* ============================================================
   INITIALIZATION
============================================================ */

/**
 * initCart()
 * Entry point — loads the cart from localStorage, fetches menu
 * item details (mock for now), then renders the cart and wires
 * up event listeners.
 */
async function initCart() {
  loadCart();

  try {
    menuItemsCache = await fetchMenuItems();
  } catch (error) {
    console.error('Failed to load menu items.', error);
    menuItemsCache = [];
  }

  renderCart();
  attachCartEventListeners();
}

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar();
  initCart();
});
