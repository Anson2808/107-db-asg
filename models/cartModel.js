const { sql } = require("../database/dbConfig");

async function getCartByUserId(userId) {
  const result = await sql.query`
    SELECT
      ci.CartItemId,
      ci.MenuItemId,
      mi.Name,
      s.StallName,
      mi.Price AS UnitPrice,
      ci.Quantity
    FROM CartItems ci
    JOIN MenuItems mi ON ci.MenuItemId = mi.MenuItemId
    JOIN Stalls s ON mi.StallId = s.StallId
    WHERE ci.UserId = ${userId}
    ORDER BY ci.CartItemId
  `;

  const cart = result.recordset.map((row) => ({
    cartItemId: row.CartItemId,
    menuItemId: row.MenuItemId,
    name: row.Name,
    stallName: row.StallName,
    unitPrice: row.UnitPrice,
    quantity: row.Quantity,
    lineTotal: row.UnitPrice * row.Quantity,
  }));

  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);

  return { cart, subtotal };
}

async function getCartItemByUserAndMenuItem(userId, menuItemId) {
  const result = await sql.query`
    SELECT * FROM CartItems
    WHERE UserId = ${userId} AND MenuItemId = ${menuItemId}
  `;
  return result.recordset[0];
}

async function insertCartItem(userId, menuItemId, quantity) {
  await sql.query`
    INSERT INTO CartItems (UserId, MenuItemId, Quantity)
    VALUES (${userId}, ${menuItemId}, ${quantity})
  `;
}

async function incrementCartItem(cartItemId, quantity) {
  await sql.query`
    UPDATE CartItems SET Quantity = Quantity + ${quantity}
    WHERE CartItemId = ${cartItemId}
  `;
}

async function updateCartQuantity(cartItemId, userId, quantity) {
  const result = await sql.query`
    UPDATE CartItems SET Quantity = ${quantity}
    WHERE CartItemId = ${cartItemId} AND UserId = ${userId}
  `;
  return result.rowsAffected[0];
}

async function removeFromCart(cartItemId, userId) {
  const result = await sql.query`
    DELETE FROM CartItems
    WHERE CartItemId = ${cartItemId} AND UserId = ${userId}
  `;
  return result.rowsAffected[0];
}

module.exports = {
  getCartByUserId,
  getCartItemByUserAndMenuItem,
  insertCartItem,
  incrementCartItem,
  updateCartQuantity,
  removeFromCart,
};
