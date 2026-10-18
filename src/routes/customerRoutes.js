const router = require("express").Router();
const { verifyToken, allowRoles } = require("../middleware/auth");
const customer = require("../controllers/customerController");
const cart = require("../controllers/cartController");
const wishlist = require("../controllers/wishlistController");
const order = require("../controllers/orderController");

console.log(typeof customer);

// Har route pe alag se lagaya hai (router.use nahi) taake admin routes pe asar na pade
const customerOnly = [verifyToken, allowRoles("customer")];

// Profile
router.get("/customers/me", verifyToken, customer.getMe);
router.put("/customers/me", customerOnly, customer.updateMe);

// Cart
router.get("/cart", customerOnly, cart.getCart);
router.post("/cart/items", customerOnly, cart.addItem);
router.put("/cart/items/:cart_item_id", customerOnly, cart.updateItem);
router.delete("/cart/items/:cart_item_id", customerOnly, cart.removeItem);
router.delete("/cart", customerOnly, cart.clearCart);

// Wishlist
router.get("/wishlist", customerOnly, wishlist.getWishlist);
router.post("/wishlist", customerOnly, wishlist.addToWishlist);
router.delete(
  "/wishlist/:product_id",
  customerOnly,
  wishlist.removeFromWishlist,
);

// Orders
router.post("/orders", customerOnly, order.placeOrder);
router.get("/orders", customerOnly, order.getMyOrders);
router.get("/orders/:id", customerOnly, order.getMyOrderById);

module.exports = router;
