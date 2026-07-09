const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { userId: user.UserId, username: user.Username, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      token,
      user: {
        UserId: user.UserId,
        username: user.Username,
        role: user.Role,
      },
    });
  } catch (err) {
    next(err);
  }
};
