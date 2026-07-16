const { createFeedback, getFeedbackById } = require("../models/feedbackModel");
const { getStallById } = require("../models/stallModel");

exports.submitFeedback = async (req, res, next) => {
  try {
    const { stallId, rating, comment } = req.body;

    const stall = await getStallById(stallId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const feedbackId = await createFeedback({
      stallId,
      userId: req.user.userId,
      rating,
      comment: comment.trim(),
    });

    const feedback = await getFeedbackById(feedbackId);
    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    next(err);
  }
};
