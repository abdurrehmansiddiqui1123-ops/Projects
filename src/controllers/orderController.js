const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');
const { ORDER_STATUSES, PAYMENT_METHODS } = require('../utils/constants');

// POST /orders   body: payment_method, shipping_address, shipping_phone
// Transaction: order banao -> cart_items se order_items -> stock kam -> cart clear
exports.placeOrder = async (req, res) => {
  const payment_method = String(req.body.payment_method ?? '').trim();
  const shipping_address = String(req.body.shipping_address ?? '').trim();
  const shipping_phone = String(req.body.shipping_phone ?? '').trim();

  if (!payment_method) return sendResponse(res, 400, 'Payment method is required');
  if (!PAYMENT_METHODS.includes(payment_method)) return sendResponse(res, 400, 'Invalid payment method');
  if (!shipping_address) return sendResponse(res, 400, 'Shipping address is required');
  if (!shipping_phone) return sendResponse(res, 400, 'Shipping phone is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [carts] = await conn.query('SELECT cart_id FROM carts WHERE customer_id = ?', [req.user.id]);
    if (!carts.length) {
      await conn.rollback();
      return sendResponse(res, 400, 'Cart is empty');
    }
    const cartId = carts[0].cart_id;

    // FOR UPDATE: in rows lock ho jati hain taake do orders ek saath stock na kha jayen
    const [items] = await conn.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.discount_price,
              p.stock_quantity, p.is_active
       FROM cart_items ci
       JOIN products p ON p.product_id = ci.product_id
       WHERE ci.cart_id = ?
       FOR UPDATE`,
      [cartId]
    );
    if (!items.length) {
      await conn.rollback();
      return sendResponse(res, 400, 'Cart is empty');
    }

    let total = 0;
    for (const item of items) {
      if (!item.is_active || item.stock_quantity < item.quantity) {
        await conn.rollback();
        return sendResponse(res, 409, `Not enough stock for "${item.name}"`);
      }
      const unitPrice = item.discount_price !== null ? item.discount_price : item.price;
      total += unitPrice * item.quantity;
    }
    total = Math.round(total * 100) / 100;

    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_id, total_amount, payment_method, shipping_address, shipping_phone)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, total, payment_method, shipping_address, shipping_phone]
    );
    const orderId = orderResult.insertId;

    await conn.query('INSERT INTO order_items (order_id, product_id, quantity) VALUES ?', [
      items.map((i) => [orderId, i.product_id, i.quantity]),
    ]);

    for (const item of items) {
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [
        item.quantity,
        item.product_id,
      ]);
    }

    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    const [orderRows] = await conn.query(
      'SELECT order_id, total_amount, status, payment_status, order_date FROM orders WHERE order_id = ?',
      [orderId]
    );

    await conn.commit();

    return sendResponse(res, 201, 'Order placed successfully', {
      ...orderRows[0],
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    });
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    console.error(err);
    return sendResponse(res, 500, 'Order failed. Please try again.');
  } finally {
    conn.release();
  }
};

// GET /orders?status=
exports.getMyOrders = async (req, res) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !ORDER_STATUSES.includes(status)) {
      return sendResponse(res, 400, 'Invalid status');
    }

    let sql = `SELECT order_id, total_amount, status, payment_status, order_date
               FROM orders WHERE customer_id = ?`;
    const params = [req.user.id];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY order_date DESC, order_id DESC';

    const [rows] = await pool.query(sql, params);
    return sendResponse(res, 200, 'Orders fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch orders');
  }
};

// GET /orders/:id
exports.getMyOrderById = async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [req.params.id]);
    if (!orders.length) return sendResponse(res, 404, 'Order not found');

    const order = orders[0];
    if (order.customer_id !== req.user.id) {
      return sendResponse(res, 403, 'You are not allowed to view this order');
    }

    const [items] = await pool.query(
      `SELECT oi.product_id, p.name, oi.quantity
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [order.order_id]
    );

    return sendResponse(res, 200, 'Order fetched', {
      order_id: order.order_id,
      total_amount: order.total_amount,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      shipping_address: order.shipping_address,
      shipping_phone: order.shipping_phone,
      order_date: order.order_date,
      items,
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch orders');
  }
};
