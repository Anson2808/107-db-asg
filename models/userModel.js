const { sql } = require("../database/dbConfig");

async function getUserByUsername(username) {
  const result = await sql.query`SELECT * FROM Users WHERE Username = ${username}`;
  return result.recordset[0];
}

async function createUser({ username, passwordHash, email, fullName, role }) {
  const result = await sql.query`
    INSERT INTO Users (Username, PasswordHash, Email, FullName, Role)
    OUTPUT INSERTED.UserId
    VALUES (${username}, ${passwordHash}, ${email}, ${fullName}, ${role})
  `;
  return result.recordset[0].UserId;
}

module.exports = { getUserByUsername, createUser };
