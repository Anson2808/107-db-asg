const { sql } = require("../database/dbConfig");

// Business constants — GST/fees are not persisted columns, so they
// live here as the single source of truth for order calculations.
const GST_RATE = 0.09;
const PACKAGING_FEE = 0.60;
const DELIVERY_FEE = 2.50;

function roundToCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * createOrder(userId, items, paymentMethod)
 * items: [{ menuItemId, quantity }, ...] — sent from the cart page.
 *
 * Prices are NEVER trusted from the client — each MenuItemId is
 * looked up live inside the transaction so a tampered request can't
 * place an order at a fake price. Runs as a single transaction:
 * Orders -> OrderItems (one row per line) -> Payments.
 */
async function createOrder(userId, items, paymentMethod) {
  const pool = await sql.connect();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Look up live price/availability/stall for every item in one go
    const menuItemIds = items.map((item) => item.menuItemId);
    const menuItemsResult = await new sql.Request(transaction).query(`
      SELECT MenuItemId, StallId, Name, Price, IsAvailable
      FROM MenuItems
      WHERE MenuItemId IN (${menuItemIds.join(",")})
    `);

    const menuItemsById = new Map(
      menuItemsResult.recordset.map((row) => [row.MenuItemId, row])
    );

    const orderLines = items.map((item) => {
      const menuItem = menuItemsById.get(item.menuItemId);

      if (!menuItem) {
        const err = new Error(`MenuItemId ${item.menuItemId} does not exist.`);
        err.statusCode = 400;
        throw err;
      }

      if (!menuItem.IsAvailable) {
        const err = new Error(`"${menuItem.Name}" is no longer available.`);
        err.statusCode = 409;
        throw err;
      }

      return {
        menuItemId: menuItem.MenuItemId,
        stallId: menuItem.StallId,
        itemName: menuItem.Name,
        unitPrice: menuItem.Price,
        quantity: item.quantity,
      };
    });

    const subtotal = orderLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0
    );
    const gst = roundToCents(subtotal * GST_RATE);
    const total = roundToCents(subtotal + PACKAGING_FEE + DELIVERY_FEE + gst);

    // Insert the order header, capturing the new OrderId
    const orderResult = await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .input("Subtotal", sql.Decimal(10, 2), roundToCents(subtotal))
      .input("PackagingFee", sql.Decimal(10, 2), PACKAGING_FEE)
      .input("DeliveryFee", sql.Decimal(10, 2), DELIVERY_FEE)
      .input("Total", sql.Decimal(10, 2), total)
      .query(`
        INSERT INTO Orders (UserId, Subtotal, PackagingFee, DeliveryFee, Total, Status)
        OUTPUT INSERTED.OrderId
        VALUES (@UserId, @Subtotal, @PackagingFee, @DeliveryFee, @Total, 'Paid')
      `);

    const orderId = orderResult.recordset[0].OrderId;
    
    // Insert one OrderItems row per line, snapshotting name/price
    for (const line of orderLines) {
      await new sql.Request(transaction)
        .input("OrderId", sql.Int, orderId)
        .input("MenuItemId", sql.Int, line.menuItemId)
        .input("StallId", sql.Int, line.stallId)
        .input("ItemName", sql.NVarChar(100), line.itemName)
        .input("UnitPrice", sql.Decimal(10, 2), line.unitPrice)
        .input("Quantity", sql.Int, line.quantity)
        .query(`
          INSERT INTO OrderItems (OrderId, MenuItemId, StallId, ItemName, UnitPrice, Quantity)
          VALUES (@OrderId, @MenuItemId, @StallId, @ItemName, @UnitPrice, @Quantity)
        `);
    }

    // Record the payment (no real payment gateway yet — treated as immediately successful)
    await new sql.Request(transaction)
      .input("OrderId", sql.Int, orderId)
      .input("Amount", sql.Decimal(10, 2), total)
      .input("Method", sql.NVarChar(50), paymentMethod)
      .query(`
        INSERT INTO Payments (OrderId, Amount, Method, Status)
        VALUES (@OrderId, @Amount, @Method, 'Success')
      `);

    // Keep the server-side cart in sync with a completed checkout.
    await new sql.Request(transaction)
      .input("UserId", sql.Int, userId)
      .query("DELETE FROM CartItems WHERE UserId = @UserId");

    await transaction.commit();

    return { orderId, subtotal: roundToCents(subtotal), packagingFee: PACKAGING_FEE, deliveryFee: DELIVERY_FEE, gst, total, status: "Paid" };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function getOrdersByUserId(userId) {
  const result = await sql.query`
    SELECT
      o.OrderId,
      o.CreatedAt,
      o.Status,
      o.Total,
      oi.ItemName,
      oi.Quantity,
      oi.UnitPrice,
      s.StallName,
      s.CuisineType
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    JOIN Stalls s ON oi.StallId = s.StallId
    WHERE o.UserId = ${userId}
    ORDER BY o.CreatedAt DESC, o.OrderId DESC
  `;

  // Group flat rows into orders with items arrays
  const ordersMap = new Map();

  for (const row of result.recordset) {
    if (!ordersMap.has(row.OrderId)) {
      ordersMap.set(row.OrderId, {
        orderId: row.OrderId,
        createdAt: row.CreatedAt,
        status: row.Status,
        total: row.Total,
        items: [],
      });
    }

    ordersMap.get(row.OrderId).items.push({
      name: row.ItemName,
      quantity: row.Quantity,
      unitPrice: row.UnitPrice,
      stallName: row.StallName,
      cuisineType: row.CuisineType,
    });
  }

  return Array.from(ordersMap.values());
}

module.exports = { getOrdersByUserId, createOrder };