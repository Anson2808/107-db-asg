const { getStallByOwnerId } = require("../models/stallModel");
const {
  getOrderStats,
  getRevenueByDay,
  getPopularItems,
  getPeakHours,
  getAverageRatingTrend,
  getSatisfactionData
} = require("../models/analyticsModel");

exports.getPerformance = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    // Determine the date range (default to monthly)
    const range = req.query.range || 'monthly';
    let days = 30; 
    if (range === 'daily') days = 1;
    if (range === 'weekly') days = 7;

    const [orderStats, revenueByDay, popularItems, peakHours, ratingTrend] = await Promise.all([
      getOrderStats(stall.StallId, days),
      getRevenueByDay(stall.StallId, days),
      getPopularItems(stall.StallId, days),
      getPeakHours(stall.StallId, days),
      getAverageRatingTrend(stall.StallId), // Overall trend is usually kept all-time
    ]);

    res.status(200).json({
      orderStats,
      revenueByDay,
      popularItems,
      peakHours,
      ratingTrend,
    });
  } catch (err) {
    next(err);
  }
};
exports.getSatisfaction = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const data = await getSatisfactionData(stall.StallId);

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};