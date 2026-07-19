const { getStallById } = require("../models/stallModel");
const {
  getFavoriteStallsByUserId,
  addFavoriteStall,
  removeFavoriteStall,
} = require("../models/favoriteStallModel");

exports.getMyFavoriteStalls = async (req, res, next) => {
  try {
    const favorites = await getFavoriteStallsByUserId(req.user.userId);
    res.status(200).json({ favorites });
  } catch (err) {
    next(err);
  }
};

exports.saveFavoriteStall = async (req, res, next) => {
  try {
    const stallId = Number(req.params.stallId);
    const stall = await getStallById(stallId);

    if (!stall) {
      return res.status(404).json({ error: "Stall not found" });
    }

    const favorite = await addFavoriteStall({
      userId: req.user.userId,
      stallId,
    });

    res.status(200).json({
      favorite,
      message: "Stall saved to favourites.",
    });
  } catch (err) {
    next(err);
  }
};

exports.removeFavoriteStall = async (req, res, next) => {
  try {
    const stallId = Number(req.params.stallId);

    await removeFavoriteStall({
      userId: req.user.userId,
      stallId,
    });

    res.status(200).json({ message: "Stall removed from favourites." });
  } catch (err) {
    next(err);
  }
};
