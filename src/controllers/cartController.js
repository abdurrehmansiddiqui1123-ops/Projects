const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');

// Cart na ho to bana deta hai
async function getOrCreateCart(customerId) {
  const [rows] = await pool.query('SELECT cart_id FROM carts WHERE customer_id = ?', [customerId]);
  if (rows.length) return rows[0].cart_id;
  const [result] = await pool.query('INSERT INTO carts (customer_id) VALUES (?)', [customerId]);
  return result.insertId;
}

// GET /cart
exports.getCart = async (req, res) => {
  try {
    const [carts] = await pool.query('SELECT cart_id FROM carts WHERE customer_id = ?', [req.user.id]);
    if (!carts.length) {
      return sendResponse(res, 200, 'Cart fetched', { cart_id: null, items: [], subtotal: 0 });
    }

    const cartId = carts[0].cart_id;
    const [items] = await pool.query(
      `SELECT ci.cart_item_id, ci.product_id, p.name, p.price, p.discount_price, ci.quantity,
              (COALESCE(p.discount_price, p.price) * ci.quantity) AS line_total
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_id = ?
       ORDER BY ci.cart_item_id`,
      [cartId]
    );

    const subtotal = Math.round(items.reduce((sum, i) => sum + i.line_total, 0) * 100) / 100;
    return sendResponse(res, 200, 'Cart fetched', { cart_id: cartId, items, subtotal });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch cart');
  }
};

// POST /cart/items   body: product_id, quantity
exports.addItem = async (req, res) => {
  try {
    const { product_id } = req.body;
    const quantity = Number(req.body.quantity);

    if (!product_id) return sendResponse(res, 400, 'Product ID is required');
    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendResponse(res, 400, 'Quantity must be at least 1');
    }

    const [products] = await pool.query(
      'SELECT product_id, stock_quantity FROM products WHERE product_id = ? AND is_active = 1',
      [product_id]
    );
    if (!products.length) return sendResponse(res, 404, 'Product not available');
    const stock = products[0].stock_quantity;

    const cartId = await getOrCreateCart(req.user.id);

    const [existing] = await pool.query(
      'SELECT cart_item_id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, product_id]
    );
    const newQty = (existing.length ? existing[0].quantity : 0) + quantity;
    if (newQty > stock) return sendResponse(res, 400, `Only ${stock} items available`);

    let cartItemId;
    if (existing.length) {
      cartItemId = existing[0].cart_item_id;
      await pool.query('UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?', [newQty, cartItemId]);
    } else {
      const [result] = await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
        [cartId, product_id, quantity]
      );
      cartItemId = result.insertId;
    }

    return sendResponse(res, 201, 'Item added to cart', {
      cart_item_id: cartItemId,
      cart_id: cartId,
      product_id: Number(product_id),
      quantity: newQty,
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not add to cart');
  }
};

// PUT /cart/items/:cart_item_id   body: quantity
exports.updateItem = async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return sendResponse(res, 400, 'Quantity must be at least 1');
    }

    // item mere hi cart ka hona chahiye
    const [rows] = await pool.query(
      `SELECT ci.cart_item_id, ci.product_id, p.stock_quantity
       FROM cart_items ci
       JOIN carts c ON c.cart_id = ci.cart_id
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_item_id = ? AND c.customer_id = ?`,
      [req.params.cart_item_id, req.user.id]
    );
    if (!rows.length) return sendResponse(res, 404, 'Cart item not found');

    if (quantity > rows[0].stock_quantity) {
      return sendResponse(res, 400, `Only ${rows[0].stock_quantity} items available`);
    }

    await pool.query('UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?', [quantity, rows[0].cart_item_id]);

    return sendResponse(res, 200, 'Cart item updated', {
      cart_item_id: rows[0].cart_item_id,
      product_id: rows[0].product_id,
      quantity,
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Update failed');
  }
};

// DELETE /cart/items/:cart_item_id
exports.removeItem = async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE ci FROM cart_items ci
       JOIN carts c ON c.cart_id = ci.cart_id
       WHERE ci.cart_item_id = ? AND c.customer_id = ?`,
      [req.params.cart_item_id, req.user.id]
    );
    if (result.affectedRows === 0) return sendResponse(res, 404, 'Cart item not found');
    return sendResponse(res, 200, 'Item removed from cart');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not remove cart item');
  }
};

// DELETE /cart
exports.clearCart = async (req, res) => {
  try {
    await pool.query(
      `DELETE ci FROM cart_items ci
       JOIN carts c ON c.cart_id = ci.cart_id
       WHERE c.customer_id = ?`,
      [req.user.id]
    );
    return sendResponse(res, 200, 'Cart cleared');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not clear cart');
  }
};
