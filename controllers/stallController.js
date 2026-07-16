const { getAllStalls, getStallByOwnerId, updateStall } = require("../models/stallModel");
const { getMenuByStallId } = require("../models/menuModel");

exports.getAllStalls = async (req, res, next) => {
  try {
    const stalls = await getAllStalls();
    res.status(200).json({ stalls });
  } catch (err) {
    next(err);
  }
};

exports.getMyStall = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const menu = await getMenuByStallId(stall.StallId);

    res.status(200).json({ stall, menu });
  } catch (err) {
    next(err);
  }
};

exports.updateMyStall = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const { stallName, description, cuisineType, status } = req.body;

    const fields = {};
    if (stallName !== undefined) fields.StallName = stallName;
    if (description !== undefined) fields.Description = description;
    if (cuisineType !== undefined) fields.CuisineType = cuisineType;
    if (status !== undefined) fields.Status = status;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await updateStall(stall.StallId, fields);

    const updated = await getStallByOwnerId(req.user.userId);
    res.status(200).json({ stall: updated });
  } catch (err) {
    next(err);
  }
};
