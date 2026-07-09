const bcrypt = require("bcryptjs");
const { getUserByUsername, createUser } = require("../models/userModel");
const { createStall } = require("../models/stallModel");

exports.register = async (req, res, next) => {
  try {
    const { username, password, email, fullName, role, stallName, cuisineType } = req.body;

    // Check for duplicate username
    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = await createUser({ username, passwordHash, email, fullName, role });

    // If stallOwner, also create their stall
    if (role === "stallOwner") {
      await createStall({ ownerId: userId, stallName, cuisineType });
    }

    res.status(201).json({
      UserId: userId,
      username,
      role,
    });
  } catch (err) {
    next(err);
  }
};
