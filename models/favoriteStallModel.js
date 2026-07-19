const { sql } = require("../database/dbConfig");

async function getFavoriteStallsByUserId(userId) {
  const result = await sql.query`
    SELECT
      f.UserId, f.StallId, f.CreatedAt,
      s.StallName, s.CuisineType, s.Description, s.Status
    FROM CustomerFavoriteStalls f
    JOIN Stalls s ON f.StallId = s.StallId
    WHERE f.UserId = ${userId}
    ORDER BY f.CreatedAt DESC, s.StallName
  `;

  return result.recordset;
}

async function addFavoriteStall({ userId, stallId }) {
  const result = await sql.query`
    IF NOT EXISTS (
      SELECT 1
      FROM CustomerFavoriteStalls
      WHERE UserId = ${userId} AND StallId = ${stallId}
    )
    BEGIN
      INSERT INTO CustomerFavoriteStalls (UserId, StallId)
      VALUES (${userId}, ${stallId})
    END

    SELECT
      f.UserId, f.StallId, f.CreatedAt,
      s.StallName, s.CuisineType, s.Description, s.Status
    FROM CustomerFavoriteStalls f
    JOIN Stalls s ON f.StallId = s.StallId
    WHERE f.UserId = ${userId} AND f.StallId = ${stallId}
  `;

  return result.recordset[0];
}

async function removeFavoriteStall({ userId, stallId }) {
  const result = await sql.query`
    DELETE FROM CustomerFavoriteStalls
    WHERE UserId = ${userId} AND StallId = ${stallId}
  `;

  return result.rowsAffected[0] > 0;
}

module.exports = {
  getFavoriteStallsByUserId,
  addFavoriteStall,
  removeFavoriteStall,
};
