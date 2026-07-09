const { sql } = require("../database/dbConfig");

async function getAllMenuItems() {
  const result = await sql.query`
    SELECT
      m.MenuItemId, m.StallId, m.Name, m.Description,
      m.Price, m.IsAvailable, m.LikeCount,
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

async function createMenuItem({ stallId, name, description, price, isAvailable }) {
  const result = await sql.query`
    INSERT INTO MenuItems (StallId, Name, Description, Price, IsAvailable)
    OUTPUT INSERTED.MenuItemId
    VALUES (${stallId}, ${name}, ${description || null}, ${price}, ${isAvailable !== false ? 1 : 0})
  `;
  return result.recordset[0].MenuItemId;
}

async function getMenuItemById(menuItemId) {
  const result = await sql.query`SELECT * FROM MenuItems WHERE MenuItemId = ${menuItemId}`;
  return result.recordset[0];
}

async function updateMenuItem(menuItemId, fields) {
  const typeMap = {
    Name: sql.NVarChar,
    Description: sql.NVarChar,
    Price: sql.Decimal(10, 2),
    IsAvailable: sql.Bit,
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
  updateMenuItem,
  deleteMenuItem,
};
