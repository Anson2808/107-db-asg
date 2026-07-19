const { getStallByOwnerId, getStallById } = require("../models/stallModel");
const { getInspectionHistory, addInspection } = require("../models/inspectionModel");

exports.getMyHygieneHistory = async (req, res, next) => {
  try {
    // 1. Verify the stall belongs to the logged-in user
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    // 2. Fetch the historical data
    const history = await getInspectionHistory(stall.StallId);

    // 3. Send back to client
    res.status(200).json({ history });
  } catch (err) {
    next(err);
  }
};

exports.addInspection = async (req, res, next) => {
  try {
    const { stallId, inspectionDate, score, grade, violations, notes } = req.body;

    // Verify stall exists
    const stall = await getStallById(stallId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const inspectionId = await addInspection({
      stallId,
      inspectionDate,
      score,
      grade,
      violations,
      notes,
    });

    // Fetch the created record via history (returns array, grab the inserted one)
    const history = await getInspectionHistory(stallId);
    const created = history.find((i) => i.InspectionId === inspectionId);

    res.status(201).json({ inspection: created });
  } catch (err) {
    next(err);
  }
};

exports.getStallInspections = async (req, res, next) => {
  try {
    const stallId = parseInt(req.params.stallId, 10);
    const stall = await getStallById(stallId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const history = await getInspectionHistory(stallId);
    res.status(200).json({ history });
  } catch (err) {
    next(err);
  }
};
 