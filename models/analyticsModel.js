const { sql } = require("../database/dbConfig");

function isYearlyRange(range) {
  return range === "yearly" || range === "ytd";
}

async function getOrderStats(stallId, range, days, year, month) {
  let query;
  if (year && month) {
    query = sql.query`
      SELECT
        COUNT(DISTINCT o.OrderId) AS totalOrders,
        ISNULL(SUM(oi.UnitPrice * oi.Quantity), 0) AS totalRevenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
    `;
  } else if (isYearlyRange(range)) {
    query = sql.query`
      SELECT
        COUNT(DISTINCT o.OrderId) AS totalOrders,
        ISNULL(SUM(oi.UnitPrice * oi.Quantity), 0) AS totalRevenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
    `;
  } else {
    query = sql.query`
      SELECT
        COUNT(DISTINCT o.OrderId) AS totalOrders,
        ISNULL(SUM(oi.UnitPrice * oi.Quantity), 0) AS totalRevenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
    `;
  }

  const result = await query;
  const row = result.recordset[0] || { totalOrders: 0, totalRevenue: 0 };
  const totalOrders = Number(row.totalOrders || 0);
  const totalRevenue = Number(row.totalRevenue || 0);
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    totalOrders,
    totalRevenue,
    aov,
  };
}

async function getBusiestDay(stallId, range, days, year, month) {
  let query;
  if (year && month) {
    query = sql.query`
      SELECT TOP 1
        DATENAME(WEEKDAY, o.CreatedAt) AS dayName,
        COUNT(DISTINCT o.OrderId) AS volume
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
      GROUP BY DATENAME(WEEKDAY, o.CreatedAt)
      ORDER BY volume DESC
    `;
  } else if (isYearlyRange(range)) {
    query = sql.query`
      SELECT TOP 1
        DATENAME(WEEKDAY, o.CreatedAt) AS dayName,
        COUNT(DISTINCT o.OrderId) AS volume
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      GROUP BY DATENAME(WEEKDAY, o.CreatedAt)
      ORDER BY volume DESC
    `;
  } else {
    query = sql.query`
      SELECT TOP 1
        DATENAME(WEEKDAY, o.CreatedAt) AS dayName,
        COUNT(DISTINCT o.OrderId) AS volume
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
      GROUP BY DATENAME(WEEKDAY, o.CreatedAt)
      ORDER BY volume DESC
    `;
  }

  const result = await query;
  const row = result.recordset[0];
  if (!row) return { dayName: "N/A", volume: 0 };

  return {
    dayName: row.dayName,
    volume: Number(row.volume || 0),
  };
}

async function getRevenueByDay(stallId, range, days, year, month) {
  if (year && month) {
    const result = await sql.query`
      SELECT
        CAST(o.CreatedAt AS DATE) AS date,
        SUM(oi.UnitPrice * oi.Quantity) AS revenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
      GROUP BY CAST(o.CreatedAt AS DATE)
      ORDER BY date
    `;
    return result.recordset;
  }

  if (isYearlyRange(range)) {
    const result = await sql.query`
      SELECT
        FORMAT(o.CreatedAt, 'yyyy-MM') AS date,
        SUM(oi.UnitPrice * oi.Quantity) AS revenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      GROUP BY FORMAT(o.CreatedAt, 'yyyy-MM')
      ORDER BY date
    `;
    return result.recordset;
  }

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

async function getPopularItems(stallId, range, days, year, month) {
  let query;
  if (year && month) {
    query = sql.query`
      SELECT TOP 5
        oi.ItemName AS name,
        SUM(oi.Quantity) AS totalQty
      FROM OrderItems oi
      JOIN Orders o ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
      GROUP BY oi.ItemName
      ORDER BY totalQty DESC
    `;
  } else if (isYearlyRange(range)) {
    query = sql.query`
      SELECT TOP 5
        oi.ItemName AS name,
        SUM(oi.Quantity) AS totalQty
      FROM OrderItems oi
      JOIN Orders o ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      GROUP BY oi.ItemName
      ORDER BY totalQty DESC
    `;
  } else {
    query = sql.query`
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
  }

  const result = await query;
  return result.recordset;
}

async function getLowestPerformingItems(stallId, range, days, year, month) {
  let query;
  if (year && month) {
    query = sql.query`
      SELECT TOP 3
        m.MenuItemId,
        m.Name AS name,
        ISNULL(SUM(CASE WHEN o.OrderId IS NOT NULL THEN oi.Quantity ELSE 0 END), 0) AS totalQty
      FROM MenuItems m
      LEFT JOIN OrderItems oi ON m.MenuItemId = oi.MenuItemId
      LEFT JOIN Orders o ON o.OrderId = oi.OrderId
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
      WHERE m.StallId = ${stallId}
      GROUP BY m.MenuItemId, m.Name
      ORDER BY totalQty ASC, m.Name ASC
    `;
  } else if (isYearlyRange(range)) {
    query = sql.query`
      SELECT TOP 3
        m.MenuItemId,
        m.Name AS name,
        ISNULL(SUM(CASE WHEN o.OrderId IS NOT NULL THEN oi.Quantity ELSE 0 END), 0) AS totalQty
      FROM MenuItems m
      LEFT JOIN OrderItems oi ON m.MenuItemId = oi.MenuItemId
      LEFT JOIN Orders o ON o.OrderId = oi.OrderId
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      WHERE m.StallId = ${stallId}
      GROUP BY m.MenuItemId, m.Name
      ORDER BY totalQty ASC, m.Name ASC
    `;
  } else {
    query = sql.query`
      SELECT TOP 3
        m.MenuItemId,
        m.Name AS name,
        ISNULL(SUM(CASE WHEN o.OrderId IS NOT NULL THEN oi.Quantity ELSE 0 END), 0) AS totalQty
      FROM MenuItems m
      LEFT JOIN OrderItems oi ON m.MenuItemId = oi.MenuItemId
      LEFT JOIN Orders o ON o.OrderId = oi.OrderId
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEADD(DAY, -${days}, GETDATE())
      WHERE m.StallId = ${stallId}
      GROUP BY m.MenuItemId, m.Name
      ORDER BY totalQty ASC, m.Name ASC
    `;
  }

  const result = await query;
  return result.recordset.map((row) => ({
    menuItemId: row.MenuItemId,
    name: row.name,
    totalQty: Number(row.totalQty || 0),
    isZeroSales: Number(row.totalQty || 0) === 0,
  }));
}

async function getPeakHours(stallId, range, days, year, month) {
  let query;
  if (year && month) {
    query = sql.query`
      SELECT
        DATEPART(HOUR, o.CreatedAt) AS hour,
        COUNT(DISTINCT o.OrderId) AS volume,
        SUM(oi.UnitPrice * oi.Quantity) AS revenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND YEAR(o.CreatedAt) = ${year}
        AND MONTH(o.CreatedAt) = ${month}
      GROUP BY DATEPART(HOUR, o.CreatedAt)
      ORDER BY hour ASC
    `;
  } else if (isYearlyRange(range)) {
    query = sql.query`
      SELECT
        DATEPART(HOUR, o.CreatedAt) AS hour,
        COUNT(DISTINCT o.OrderId) AS volume,
        SUM(oi.UnitPrice * oi.Quantity) AS revenue
      FROM Orders o
      JOIN OrderItems oi ON o.OrderId = oi.OrderId
      WHERE oi.StallId = ${stallId}
        AND o.Status IN ('Paid', 'Completed')
        AND o.CreatedAt >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
      GROUP BY DATEPART(HOUR, o.CreatedAt)
      ORDER BY hour ASC
    `;
  } else {
    query = sql.query`
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
  }

  const result = await query;
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
    SELECT f.FeedbackId, f.Rating, f.Category, f.Comment, f.OwnerReply, f.RepliedAt, f.CreatedAt, u.Username
    FROM Feedback f
    JOIN Users u ON f.UserId = u.UserId
    WHERE f.StallId = ${stallId}
    ORDER BY f.CreatedAt DESC
  `;
  return { feedback: result.recordset };
}

module.exports = {
  getOrderStats,
  getBusiestDay,
  getRevenueByDay,
  getPopularItems,
  getLowestPerformingItems,
  getPeakHours,
  getAverageRatingTrend,
  getSatisfactionData
};