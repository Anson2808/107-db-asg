const { sql } = require("../database/dbConfig");

async function getOrderStats(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT
      COUNT(DISTINCT o.OrderId) AS totalOrders,
      ISNULL(SUM(oi.UnitPrice * oi.Quantity), 0) AS totalRevenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
  `;

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

async function getBusiestDay(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT TOP 1
      DATENAME(WEEKDAY, o.CreatedAt) AS dayName,
      COUNT(DISTINCT o.OrderId) AS volume
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
    GROUP BY DATENAME(WEEKDAY, o.CreatedAt)
    ORDER BY volume DESC
  `;

  const row = result.recordset[0];
  if (!row) return { dayName: "N/A", volume: 0 };

  return {
    dayName: row.dayName,
    volume: Number(row.volume || 0),
  };
}

async function getRevenueByDay(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT
      FORMAT(o.CreatedAt, 'yyyy-MM-dd') AS date,
      SUM(oi.UnitPrice * oi.Quantity) AS revenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
    GROUP BY FORMAT(o.CreatedAt, 'yyyy-MM-dd')
    ORDER BY date ASC
  `;
  return result.recordset;
}

async function getPopularItems(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT TOP 5
      oi.ItemName AS name,
      SUM(oi.Quantity) AS totalQty
    FROM OrderItems oi
    JOIN Orders o ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
    GROUP BY oi.ItemName
    ORDER BY totalQty DESC
  `;
  return result.recordset;
}

async function getLowestPerformingItems(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT TOP 3
      oi.ItemName AS name,
      SUM(oi.Quantity) AS totalQty
    FROM OrderItems oi
    JOIN Orders o ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
    GROUP BY oi.ItemName
    ORDER BY totalQty ASC, oi.ItemName ASC
  `;

  return result.recordset.map((row) => ({
    name: row.name,
    totalQty: Number(row.totalQty || 0),
    isZeroSales: Number(row.totalQty || 0) === 0,
  }));
}

async function getPeakHours(stallId, startDateTime, endDateTime) {
  const result = await sql.query`
    SELECT
      DATEPART(HOUR, o.CreatedAt) AS hour,
      COUNT(DISTINCT o.OrderId) AS volume,
      SUM(oi.UnitPrice * oi.Quantity) AS revenue
    FROM Orders o
    JOIN OrderItems oi ON o.OrderId = oi.OrderId
    WHERE oi.StallId = ${stallId}
      AND o.Status IN ('Paid', 'Completed')
      AND o.CreatedAt >= ${startDateTime}
      AND o.CreatedAt <= ${endDateTime}
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
      ROUND(AVG(CAST(Rating AS FLOAT)), 2) AS avgRating,
      COUNT(*) AS totalReviews
    FROM Feedback
    WHERE StallId = ${stallId}
    GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
    ORDER BY year ASC, month ASC
  `;
  return result.recordset;
}

async function getSatisfactionData(stallId) {
  const ratingRes = await sql.query`
    SELECT
      ISNULL(AVG(CAST(Rating AS FLOAT)), 0) AS avgRating,
      COUNT(*) AS totalCount
    FROM Feedback
    WHERE StallId = ${stallId}
  `;

  const breakdownRes = await sql.query`
    SELECT Rating, COUNT(*) AS count
    FROM Feedback
    WHERE StallId = ${stallId}
    GROUP BY Rating
  `;

  const feedbackRes = await sql.query`
    SELECT
      f.FeedbackId,
      f.Rating,
      f.Category,
      f.Comment,
      f.OwnerReply,
      f.RepliedAt,
      f.CreatedAt,
      ISNULL(u.FullName, u.Username) AS CustomerName
    FROM Feedback f
    LEFT JOIN Users u ON f.UserId = u.UserId
    WHERE f.StallId = ${stallId}
    ORDER BY f.CreatedAt DESC
  `;

  const total = ratingRes.recordset[0].totalCount || 0;
  const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  breakdownRes.recordset.forEach((r) => {
    ratingCounts[r.Rating] = r.count;
  });

  const ratingBreakdown = {};
  for (let i = 1; i <= 5; i++) {
    ratingBreakdown[i] = {
      count: ratingCounts[i],
      pct: total > 0 ? Math.round((ratingCounts[i] / total) * 100) : 0,
    };
  }

  return {
    avgRating: Number(Number(ratingRes.recordset[0].avgRating || 0).toFixed(1)),
    totalCount: total,
    ratingBreakdown,
    feedback: feedbackRes.recordset,
  };
}

module.exports = {
  getOrderStats,
  getBusiestDay,
  getRevenueByDay,
  getPopularItems,
  getLowestPerformingItems,
  getPeakHours,
  getAverageRatingTrend,
  getSatisfactionData,
};