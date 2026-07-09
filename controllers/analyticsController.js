const { getStallByOwnerId } = require("../models/stallModel");
const {
  getOrderStats,
  getRevenueByDay,
  getPopularItems,
  getAverageRatingTrend,
} = require("../models/analyticsModel");

exports.getPerformance = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const [orderStats, revenueByDay, popularItems, ratingTrend] = await Promise.all([
      getOrderStats(stall.StallId),
      getRevenueByDay(stall.StallId),
      getPopularItems(stall.StallId),
      getAverageRatingTrend(stall.StallId),
    ]);

    res.status(200).json({
      orderStats,
      revenueByDay,
      popularItems,
      ratingTrend,
    });
  } catch (err) {
    next(err);
  }
};
