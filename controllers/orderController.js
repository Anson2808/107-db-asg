const { getOrdersByUserId, createOrder } = require("../models/orderModel");

exports.getMyOrderHistory = async (req, res, next) => {
  try {
    const orders = await getOrdersByUserId(req.user.userId);
    res.status(200).json({ orders });
  } catch (err) {
    next(err);
  }
};

exports.placeOrder = async (req, res, next) => {
  try {
    const { items, paymentMethod } = req.body;
    const userId = req.user ? req.user.userId : null;
    const order = await createOrder(userId, items, paymentMethod);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
};