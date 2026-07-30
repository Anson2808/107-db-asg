const { getStallByOwnerId } = require("../models/stallModel");
const {
  getOrderStats,
  getBusiestDay,
  getRevenueByDay,
  getPopularItems,
  getLowestPerformingItems,
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

    const range = req.query.range || 'monthly';
    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;

    let days = 30; 
    if (range === 'daily' || range === 'today') days = 1;
    if (range === 'weekly') days = 7;
    if (range === 'monthly') days = 30;
    if (range === 'yearly' || range === 'ytd') days = 365;

    const [orderStats, busiestDay, revenueByDay, popularItems, lowestPerformingItems, peakHours, ratingTrend] = await Promise.all([
      getOrderStats(stall.StallId, range, days, year, month),
      getBusiestDay(stall.StallId, range, days, year, month),
      getRevenueByDay(stall.StallId, range, days, year, month),
      getPopularItems(stall.StallId, range, days, year, month),
      getLowestPerformingItems(stall.StallId, range, days, year, month),
      getPeakHours(stall.StallId, range, days, year, month),
      getAverageRatingTrend(stall.StallId),
    ]);

    res.status(200).json({
      stallName: stall.StallName,
      orderStats,
      busiestDay,
      revenueByDay,
      popularItems,
      lowestPerformingItems,
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