const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');

// GET /wishlist
exports.getWishlist = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.wishlist_id, w.product_id, p.name, p.price, p.discount_price, p.image_url, w.added_at
       FROM wishlists w
       JOIN products p ON p.product_id = w.product_id
       WHERE w.customer_id = ?
       ORDER BY w.added_at DESC, w.wishlist_id DESC`,
      [req.user.id]
    );
    return sendResponse(res, 200, 'Wishlist fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch wishlist');
  }
};

// POST /wishlist   body: product_id
exports.addToWishlist = async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return sendResponse(res, 400, 'Product ID is required');

    const [products] = await pool.query('SELECT product_id FROM products WHERE product_id = ?', [product_id]);
    if (!products.length) return sendResponse(res, 404, 'Product not found');

    const [dup] = await pool.query(
      'SELECT wishlist_id FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );
    if (dup.length) return sendResponse(res, 409, 'Already in wishlist');

    const [result] = await pool.query(
      'INSERT INTO wishlists (customer_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );

    return sendResponse(res, 201, 'Added to wishlist', {
      wishlist_id: result.insertId,
      customer_id: req.user.id,
      product_id: Number(product_id),
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return sendResponse(res, 409, 'Already in wishlist');
    return sendResponse(res, 500, 'Could not add to wishlist');
  }
};

// DELETE /wishlist/:product_id
exports.removeFromWishlist = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?',
      [req.user.id, req.params.product_id]
    );
    if (result.affectedRows === 0) return sendResponse(res, 404, 'Wishlist item not found');
    return sendResponse(res, 200, 'Removed from wishlist');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not remove wishlist item');
  }
};
