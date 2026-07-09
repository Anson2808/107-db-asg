const { getStallByOwnerId } = require("../models/stallModel");
const {
  getAllMenuItems,
  createMenuItem,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
} = require("../models/menuModel");

exports.getAllMenuItems = async (req, res, next) => {
  try {
    const items = await getAllMenuItems();
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
};

exports.addMenuItem = async (req, res, next) => {
  try {
    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const { name, description, price, isAvailable } = req.body;

    const menuItemId = await createMenuItem({
      stallId: stall.StallId,
      name,
      description,
      price,
      isAvailable,
    });

    const item = await getMenuItemById(menuItemId);

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
};

exports.updateMenuItem = async (req, res, next) => {
  try {
    const item = await getMenuItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall || item.StallId !== stall.StallId) {
      return res.status(403).json({ error: "Forbidden: you do not own this menu item" });
    }

    const { name, description, price, isAvailable } = req.body;

    const fields = {};
    if (name !== undefined) fields.Name = name;
    if (description !== undefined) fields.Description = description;
    if (price !== undefined) fields.Price = price;
    if (isAvailable !== undefined) fields.IsAvailable = isAvailable;

    await updateMenuItem(item.MenuItemId, fields);

    const updated = await getMenuItemById(item.MenuItemId);
    res.status(200).json({ item: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteMenuItem = async (req, res, next) => {
  try {
    const item = await getMenuItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    const stall = await getStallByOwnerId(req.user.userId);
    if (!stall || item.StallId !== stall.StallId) {
      return res.status(403).json({ error: "Forbidden: you do not own this menu item" });
    }

    await deleteMenuItem(item.MenuItemId);

    res.status(200).json({ message: "Menu item deleted" });
  } catch (err) {
    next(err);
  }
};
