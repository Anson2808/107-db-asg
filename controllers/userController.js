const bcrypt = require("bcryptjs");
const {
  getUserById,
  getUserWithHashById,
  updateUser,
} = require("../models/userModel");

exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const { email, fullName, currentPassword, newPassword } = req.body;

    const fields = {};
    if (email !== undefined) fields.Email = email;
    if (fullName !== undefined) fields.FullName = fullName;

    if (newPassword) {
      const user = await getUserWithHashById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      fields.PasswordHash = await bcrypt.hash(newPassword, 10);
    }

    await updateUser(req.user.userId, fields);

    const updated = await getUserById(req.user.userId);
    res.status(200).json({ user: updated });
  } catch (err) {
    next(err);
  }
};
