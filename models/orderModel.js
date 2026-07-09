const { sql } = require("../database/dbConfig");

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

module.exports = { getOrdersByUserId };
