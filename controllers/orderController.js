const { getOrdersByUserId } = require("../models/orderModel");

exports.getMyOrderHistory = async (req, res, next) => {
  try {
    const orders = await getOrdersByUserId(req.user.userId);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
};
