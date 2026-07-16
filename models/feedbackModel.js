const { sql } = require("../database/dbConfig");

async function createFeedback({ stallId, userId, rating, comment }) {
  const result = await sql.query`
    INSERT INTO Feedback (StallId, UserId, Rating, Comment)
    OUTPUT INSERTED.FeedbackId
    VALUES (${stallId}, ${userId}, ${rating}, ${comment})
  `;

  return result.recordset[0].FeedbackId;
}

async function getFeedbackById(feedbackId) {
  const result = await sql.query`
    SELECT
      f.FeedbackId, f.StallId, f.UserId, f.Rating, f.Comment, f.CreatedAt,
      s.StallName, s.CuisineType
    FROM Feedback f
    JOIN Stalls s ON f.StallId = s.StallId
    WHERE f.FeedbackId = ${feedbackId}
  `;

  return result.recordset[0];
}

async function getReviewsByStallId(stallId, sort = "newest") {
  const orderBy = sort === "highest" ? "f.Rating DESC, f.CreatedAt DESC" : "f.CreatedAt DESC";
  const request = new sql.Request();

  request.input("stallId", sql.Int, stallId);

  const result = await request.query(`
    SELECT
      f.FeedbackId, f.StallId, f.UserId, f.Rating, f.Comment, f.CreatedAt,
      u.Username
    FROM Feedback f
    LEFT JOIN Users u ON f.UserId = u.UserId
    WHERE f.StallId = @stallId
    ORDER BY ${orderBy}
  `);

  return result.recordset;
}

async function getReviewSummaryByStallId(stallId) {
  const result = await sql.query`
    SELECT
      COUNT(*) AS ReviewCount,
      COALESCE(AVG(CAST(Rating AS DECIMAL(10, 2))), 0) AS AverageRating
    FROM Feedback
    WHERE StallId = ${stallId}
  `;

  return result.recordset[0];
}

module.exports = { createFeedback, getFeedbackById, getReviewsByStallId, getReviewSummaryByStallId };
