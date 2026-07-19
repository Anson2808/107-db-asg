const { sql } = require("../database/dbConfig");

async function getOrderStats(stallId, days) {
  const result = await sql.query`
    SELECT
      COUNT(DISTINCT o.OrderId) AS totalOrders,
      ISNULL(SUM(oi.UnitPrice * oi.Quantity), 0) AS totalRevenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
  `;
  return result.recordset[0];
}

async function getRevenueByDay(stallId, days) {
  const result = await sql.query`
    SELECT
      CAST(o.CreatedAt AS DATE) AS date,
      SUM(oi.UnitPrice * oi.Quantity) AS revenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
    GROUP BY CAST(o.CreatedAt AS DATE)
    ORDER BY date
  `;
  return result.recordset;
}

async function getPopularItems(stallId, days) {
  const result = await sql.query`
    SELECT TOP 5
      oi.ItemName AS name,
      SUM(oi.Quantity) AS totalQty
    FROM OrderItems oi
    JOIN Orders o ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
    GROUP BY oi.ItemName
    ORDER BY totalQty DESC
  `;
  return result.recordset;
}

async function getPeakHours(stallId, days) {
  const result = await sql.query`
    SELECT
      DATEPART(HOUR, o.CreatedAt) AS hour,
      COUNT(DISTINCT o.OrderId) AS volume,
      SUM(oi.UnitPrice * oi.Quantity) AS revenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
    GROUP BY DATEPART(HOUR, o.CreatedAt)
    ORDER BY hour ASC
  `;
  return result.recordset;
}

async function getAverageRatingTrend(stallId) {
  const result = await sql.query`
    SELECT
      YEAR(CreatedAt) AS year,
      MONTH(CreatedAt) AS month,
      ROUND(AVG(CAST(Rating AS FLOAT)), 1) AS avgRating
    FROM Feedback
    WHERE StallId = ${stallId}
    GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
    ORDER BY year, month
  `;
  return result.recordset;
}

async function getSatisfactionData(stallId) {
  const result = await sql.query`
    SELECT f.Rating, f.Category, f.Comment, f.CreatedAt, u.Username
    FROM Feedback f
    JOIN Users u ON f.UserId = u.UserId
    WHERE f.StallId = ${stallId}
    ORDER BY f.CreatedAt DESC
  `;
  return { feedback: result.recordset };
}

module.exports = {
  getOrderStats,
  getRevenueByDay,
  getPopularItems,
  getPeakHours,
  getAverageRatingTrend,
  getSatisfactionData
};