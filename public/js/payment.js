'use strict';

const PAYMENT_CONFIG = Object.freeze({ storageKey: 'freshbite_cart', gstRate: 0.09, packagingFee: 0.60, deliveryFee: 2.50 });
let paymentCart = [];
let menuById = new Map();

function currency(value) { return `$${Number(value).toFixed(2)}`; }

function readCart() {
  try { return JSON.parse(localStorage.getItem(PAYMENT_CONFIG.storageKey)) || []; }
  catch { return []; }
}

async function loadMenu() {
  const data = await api('/menu');
  menuById = new Map((data.items || []).map((item) => [item.MenuItemId, item]));
}

function getValidCart() {
  return paymentCart.filter(({ menuItemId, quantity }) => {
    const item = menuById.get(menuItemId);
    return item && item.IsAvailable && Number.isInteger(quantity) && quantity > 0;
  });
}

function renderSummary() {
  const itemsElement = document.getElementById('payment-items');
  const validCart = getValidCart();
  const subtotal = validCart.reduce((sum, line) => sum + Number(menuById.get(line.menuItemId).Price) * line.quantity, 0);
  const packaging = validCart.length ? PAYMENT_CONFIG.packagingFee : 0;
  const delivery = validCart.length ? PAYMENT_CONFIG.deliveryFee : 0;
  const gst = subtotal * PAYMENT_CONFIG.gstRate;
  const total = subtotal + packaging + delivery + gst;

  itemsElement.innerHTML = validCart.length ? validCart.map((line) => {
    const item = menuById.get(line.menuItemId);
    return `<li class="payment-item"><span><span class="payment-item-name">${escapeHtml(item.Name)}</span><span class="payment-item-meta">${line.quantity} × ${currency(item.Price)}</span></span><span class="payment-item-price">${currency(Number(item.Price) * line.quantity)}</span></li>`;
  }).join('') : '<li class="payment-empty">Your cart is empty. Return to the menu to add items.</li>';

  document.getElementById('payment-subtotal').textContent = currency(subtotal);
  document.getElementById('payment-packaging').textContent = currency(packaging);
  document.getElementById('payment-delivery').textContent = currency(delivery);
  document.getElementById('payment-gst').textContent = currency(gst);
  document.getElementById('payment-total').textContent = currency(total);
  document.getElementById('pay-button').disabled = validCart.length === 0;
}

async function submitPayment(event) {
  event.preventDefault();
  const button = document.getElementById('pay-button');
  const message = document.getElementById('payment-message');
  const items = getValidCart().map(({ menuItemId, quantity }) => ({ menuItemId, quantity }));
  if (!items.length) return;

  button.disabled = true;
  button.textContent = 'Placing order…';
  message.textContent = '';
  try {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const { order } = await api('/orders', { method: 'POST', body: JSON.stringify({ items, paymentMethod }) });
    localStorage.removeItem(PAYMENT_CONFIG.storageKey);
    updateCartBadge();
    message.textContent = `Order #${order.orderId} placed successfully. Redirecting…`;
    message.classList.add('success');
    setTimeout(() => { window.location.href = '/order-history.html'; }, 900);
  } catch (error) {
    message.textContent = error.message || 'We could not place your order. Please try again.';
    message.classList.remove('success');
    button.disabled = false;
    button.textContent = 'Place order';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  renderNavbar();
  if (!isLoggedIn()) { window.location.href = '/login.html'; return; }
  paymentCart = readCart();
  try { await loadMenu(); renderSummary(); }
  catch (error) { document.getElementById('payment-message').textContent = 'Unable to load your order. Please try again.'; }
  document.getElementById('payment-form').addEventListener('submit', submitPayment);
});
