const {
  createFeedback,
  getFeedbackById,
  getFeedbackByUserId,
  updateFeedback,
  deleteFeedback,
} = require("../models/feedbackModel");
const { getStallById } = require("../models/stallModel");

exports.submitFeedback = async (req, res, next) => {
  try {
    const { stallId, rating, comment, category } = req.body;

    const stall = await getStallById(stallId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const feedbackId = await createFeedback({
      stallId,
      userId: req.user.userId,
      rating,
      comment: comment.trim(),
      category,
    });

    const feedback = await getFeedbackById(feedbackId);
    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    next(err);
  }
};

exports.getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await getFeedbackByUserId(req.user.userId);
    res.status(200).json({ feedback });
  } catch (err) {
    next(err);
  }
};

exports.updateMyFeedback = async (req, res, next) => {
  try {
    const feedbackId = Number(req.params.feedbackId);
    const { rating, comment, category } = req.body;

    const updated = await updateFeedback({
      feedbackId,
      userId: req.user.userId,
      rating,
      comment: comment.trim(),
      category,
    });

    if (!updated) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    const feedback = await getFeedbackById(feedbackId);
    res.status(200).json({ message: "Feedback updated successfully", feedback });
  } catch (err) {
    next(err);
  }
};

exports.deleteMyFeedback = async (req, res, next) => {
  try {
    const feedbackId = Number(req.params.feedbackId);
    const deleted = await deleteFeedback({
      feedbackId,
      userId: req.user.userId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.status(200).json({ message: "Feedback deleted successfully" });
  } catch (err) {
    next(err);
  }
};
