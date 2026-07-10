const { getMenuItemById } = require("../models/menuModel");
const {
  getCartByUserId,
  getCartItemByUserAndMenuItem,
  insertCartItem,
  incrementCartItem,
  updateCartQuantity,
  removeFromCart,
} = require("../models/cartModel");

exports.addToCart = async (req, res, next) => {
  try {
    const { menuItemId } = req.body;
    const quantity = req.body.quantity || 1;

    const menuItem = await getMenuItemById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    if (!menuItem.IsAvailable) {
      return res.status(400).json({ error: "Menu item is not available" });
    }

    const existing = await getCartItemByUserAndMenuItem(req.user.userId, menuItemId);
    if (existing) {
      await incrementCartItem(existing.CartItemId, quantity);
    } else {
      await insertCartItem(req.user.userId, menuItemId, quantity);
    }

    const fullCart = await getCartByUserId(req.user.userId);
    res.status(201).json(fullCart);
  } catch (err) {
    next(err);
  }
};

exports.getCart = async (req, res, next) => {
  try {
    const fullCart = await getCartByUserId(req.user.userId);
    res.status(200).json(fullCart);
  } catch (err) {
    next(err);
  }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    const affected = await updateCartQuantity(cartItemId, req.user.userId, quantity);
    if (affected === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const fullCart = await getCartByUserId(req.user.userId);
    res.status(200).json(fullCart);
  } catch (err) {
    next(err);
  }
};

exports.removeFromCart = async (req, res, next) => {
  try {
    const { cartItemId } = req.params;

    const affected = await removeFromCart(cartItemId, req.user.userId);
    if (affected === 0) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const fullCart = await getCartByUserId(req.user.userId);
    res.status(200).json(fullCart);
  } catch (err) {
    next(err);
  }
};
