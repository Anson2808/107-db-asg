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

module.exports = { createFeedback, getFeedbackById };
