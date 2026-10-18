// 4.5 Orders (admin)
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');
const { getPagination } = require('../utils/helpers');
const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../utils/constants');

// GET /admin/orders?status=&payment_status=&page=&limit=
exports.listOrders = async (req, res) => {
  try {
    const { status, payment_status } = req.query;
    if (status !== undefined && !ORDER_STATUSES.includes(status)) return sendResponse(res, 400, 'Invalid status');
    if (payment_status !== undefined && !PAYMENT_STATUSES.includes(payment_status)) {
      return sendResponse(res, 400, 'Invalid payment status');
    }
    const pg = getPagination(req.query);
    if (!pg) return sendResponse(res, 400, 'Invalid pagination');

    const where = [];
    const params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (payment_status) { where.push('o.payment_status = ?'); params.push(payment_status); }

    const [rows] = await pool.query(
      `SELECT o.order_id, o.customer_id, c.name AS customer_name, o.total_amount,
              o.status, o.payment_status, o.order_date
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY o.order_date DESC, o.order_id DESC
       LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );
    return sendResponse(res, 200, 'Orders fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch orders');
  }
};

// GET /admin/orders/:id
exports.getOrder = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone_number AS customer_phone
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       WHERE o.order_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return sendResponse(res, 404, 'Order not found');
    const o = rows[0];

    const [items] = await pool.query(
      `SELECT oi.product_id, p.name, oi.quantity
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [o.order_id]
    );

    return sendResponse(res, 200, 'Order fetched', {
      order_id: o.order_id,
      customer: {
        customer_id: o.customer_id,
        name: o.customer_name,
        email: o.customer_email,
        phone_number: o.customer_phone,
      },
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      total_amount: o.total_amount,
      shipping_address: o.shipping_address,
      shipping_phone: o.shipping_phone,
      status: o.status,
      order_date: o.order_date,
      items,
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch orders');
  }
};

// PUT /admin/orders/:id/status   body: status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) return sendResponse(res, 400, 'Invalid status');

    const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return sendResponse(res, 404, 'Order not found');

    return sendResponse(res, 200, 'Order status updated', { order_id: Number(req.params.id), status });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not update order status');
  }
};

// PUT /admin/orders/:id/payment-status   body: payment_status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { payment_status } = req.body;
    if (!PAYMENT_STATUSES.includes(payment_status)) return sendResponse(res, 400, 'Invalid payment status');

    const [result] = await pool.query('UPDATE orders SET payment_status = ? WHERE order_id = ?', [
      payment_status,
      req.params.id,
    ]);
    if (result.affectedRows === 0) return sendResponse(res, 404, 'Order not found');

    return sendResponse(res, 200, 'Payment status updated', {
      order_id: Number(req.params.id),
      payment_status,
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not update payment status');
  }
};

// DELETE /admin/orders/:id   (order_items cascade se delete)
exports.deleteOrder = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM orders WHERE order_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return sendResponse(res, 404, 'Order not found');
    return sendResponse(res, 200, 'Order deleted');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not delete order');
  }
};
