// 4.1 Admin account + 4.6 Dashboard
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');
const { isValidEmail } = require('../utils/helpers');

// GET /admin/me
exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT admin_id, name, email, created_at FROM admin WHERE admin_id = ?',
      [req.user.id]
    );
    if (!rows.length) return sendResponse(res, 404, 'Admin not found');
    return sendResponse(res, 200, 'Admin profile fetched', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch admin profile');
  }
};

// POST /admin/register   body: name, email, password
exports.registerAdmin = async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');

    if (!name || !email || !password) {
      return sendResponse(res, 400, 'Name, email, and password are required');
    }
    if (!isValidEmail(email)) return sendResponse(res, 400, 'Invalid email format');
    if (password.length < 6) return sendResponse(res, 400, 'Password must be at least 6 characters');

    const [existing] = await pool.query('SELECT admin_id FROM admin WHERE email = ?', [email]);
    if (existing.length) return sendResponse(res, 409, 'Email already registered');

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admin (name, email, password) VALUES (?, ?, ?)',
      [name, email, hash]
    );

    return sendResponse(res, 201, 'Admin created', { admin_id: result.insertId, name, email });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return sendResponse(res, 409, 'Email already registered');
    return sendResponse(res, 500, 'Registration failed. Please try again.');
  }
};

// GET /admin/stats
exports.getStats = async (req, res) => {
  try {
    const [[orderStats]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'Completed' THEN total_amount END), 0) AS total_sales,
         COUNT(*) AS total_orders,
         COALESCE(SUM(status = 'Pending'), 0) AS pending_orders
       FROM orders`
    );
    const [[{ total_customers }]] = await pool.query('SELECT COUNT(*) AS total_customers FROM customers');
    const [[{ total_products }]] = await pool.query('SELECT COUNT(*) AS total_products FROM products');

    return sendResponse(res, 200, 'Stats fetched', {
      total_sales: Number(orderStats.total_sales),
      total_orders: Number(orderStats.total_orders),
      pending_orders: Number(orderStats.pending_orders),
      total_customers: Number(total_customers),
      total_products: Number(total_products),
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch stats');
  }
};
