const { sql } = require("../database/dbConfig");

async function getAllMenuItems() {
  const result = await sql.query`
    SELECT
      m.MenuItemId, m.StallId, m.Name, m.Description,
      m.Price, m.Availability, m.IsAvailable, m.LikeCount, m.ImageUrl,
      s.StallName, s.CuisineType
    FROM MenuItems m
    JOIN Stalls s ON m.StallId = s.StallId
    ORDER BY s.StallName, m.Name
  `;
  return result.recordset;
}

async function getMenuByStallId(stallId) {
  const result = await sql.query`
    SELECT * FROM MenuItems WHERE StallId = ${stallId}
    ORDER BY Name
  `;
  return result.recordset;
}

async function createMenuItem({ stallId, name, description, price, availability, imageUrl }) {
  const result = await sql.query`
    INSERT INTO MenuItems (StallId, Name, Description, Price, Availability, ImageUrl)
    OUTPUT INSERTED.MenuItemId
    VALUES (${stallId}, ${name}, ${description || null}, ${price}, ${availability || "available"}, ${imageUrl || null})
  `;
  return result.recordset[0].MenuItemId;
}

async function getMenuItemById(menuItemId) {
  const result = await sql.query`SELECT * FROM MenuItems WHERE MenuItemId = ${menuItemId}`;
  return result.recordset[0];
}

async function likeMenuItem({ menuItemId, userId }) {
  const transaction = new sql.Transaction();

  await transaction.begin();

  try {
    const request = new sql.Request(transaction);
    request.input("menuItemId", sql.Int, menuItemId);
    request.input("userId", sql.Int, userId);

    const existing = await request.query(`
      SELECT 1 AS AlreadyLiked
      FROM MenuItemLikes
      WHERE UserId = @userId AND MenuItemId = @menuItemId
    `);

    if (existing.recordset.length > 0) {
      const current = await request.query(`
        SELECT MenuItemId, LikeCount
        FROM MenuItems
        WHERE MenuItemId = @menuItemId
      `);

      await transaction.commit();
      return { item: current.recordset[0], alreadyLiked: true };
    }

    await request.query(`
      INSERT INTO MenuItemLikes (UserId, MenuItemId)
      VALUES (@userId, @menuItemId)
    `);

    const updated = await request.query(`
      UPDATE MenuItems
      SET LikeCount = LikeCount + 1
      OUTPUT INSERTED.MenuItemId, INSERTED.LikeCount
      WHERE MenuItemId = @menuItemId
    `);

    await transaction.commit();
    return { item: updated.recordset[0], alreadyLiked: false };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function updateMenuItem(menuItemId, fields) {
  // IsAvailable is a computed column — it is derived from Availability
  // by the database and must never be written to directly.
  const typeMap = {
    Name: sql.NVarChar,
    Description: sql.NVarChar,
    Price: sql.Decimal(10, 2),
    Availability: sql.NVarChar,
    ImageUrl: sql.NVarChar,
  };

  const allowed = Object.keys(typeMap);
  const setClauses = [];
  const inputs = {};

  for (const [key, value] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      if (value === null) {
        setClauses.push(`${key} = NULL`);
      } else {
        const paramName = `param_${key}`;
        setClauses.push(`${key} = @${paramName}`);
        inputs[paramName] = { name: paramName, type: typeMap[key], value };
      }
    }
  }

  if (setClauses.length === 0) return null;

  const request = new sql.Request();
  for (const [, def] of Object.entries(inputs)) {
    request.input(def.name, def.type, def.value);
  }

  const query = `UPDATE MenuItems SET ${setClauses.join(", ")} WHERE MenuItemId = @menuItemId`;
  request.input("menuItemId", sql.Int, menuItemId);

  await request.query(query);
  return true;
}

async function deleteMenuItem(menuItemId) {
  await sql.query`DELETE FROM MenuItems WHERE MenuItemId = ${menuItemId}`;
}

module.exports = {
  getAllMenuItems,
  getMenuByStallId,
  createMenuItem,
  getMenuItemById,
  likeMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
