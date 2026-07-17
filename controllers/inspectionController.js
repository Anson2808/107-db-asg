const { getStallByOwnerId } = require("../models/stallModel");
const { getInspectionHistory } = require("../models/inspectionModel");

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
 