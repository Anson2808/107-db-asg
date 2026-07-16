const { createComplaint, getComplaintById } = require("../models/complaintModel");
const { getStallById } = require("../models/stallModel");

exports.submitComplaint = async (req, res, next) => {
  try {
    const { stallId, category, description } = req.body;

    const stall = await getStallById(stallId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const complaintId = await createComplaint({
      stallId,
      userId: req.user.userId,
      category,
      description: description.trim(),
    });

    const complaint = await getComplaintById(complaintId);
    res.status(201).json({ message: "Complaint submitted successfully", complaint });
  } catch (err) {
    next(err);
  }
};
