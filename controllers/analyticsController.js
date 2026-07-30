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

    let startDate = req.query.startDate;
    let endDate = req.query.endDate;

    if (!startDate || !endDate) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      startDate = `${year}-${month}-01`;
      endDate = `${year}-${month}-${day}`;
    }

    const startDateTime = `${startDate} 00:00:00`;
    const endDateTime = `${endDate} 23:59:59`;

    const [orderStats, busiestDay, revenueByDay, popularItems, lowestPerformingItems, peakHours, ratingTrend] = await Promise.all([
      getOrderStats(stall.StallId, startDateTime, endDateTime),
      getBusiestDay(stall.StallId, startDateTime, endDateTime),
      getRevenueByDay(stall.StallId, startDateTime, endDateTime),
      getPopularItems(stall.StallId, startDateTime, endDateTime),
      getLowestPerformingItems(stall.StallId, startDateTime, endDateTime),
      getPeakHours(stall.StallId, startDateTime, endDateTime),
      getAverageRatingTrend(stall.StallId),
    ]);

    res.status(200).json({
      stallName: stall.StallName,
      startDate,
      endDate,
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