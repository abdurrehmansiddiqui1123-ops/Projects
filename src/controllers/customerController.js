const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');

const PROFILE_FIELDS = 'customer_id, name, email, phone_number, address, created_at';

// GET /customers/me
exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${PROFILE_FIELDS} FROM customers WHERE customer_id = ?`, [req.user.id]);
    if (!rows.length) return sendResponse(res, 404, 'Customer not found');
    return sendResponse(res, 200, 'Profile fetched', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch profile');
  }
};

// PUT /customers/me   body: name, phone_number, address
exports.updateMe = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [req.user.id]);
    if (!rows.length) return sendResponse(res, 404, 'Customer not found');
    const current = rows[0];

    const name = String(req.body.name ?? '').trim();
    if (!name) return sendResponse(res, 400, 'Name is required');
    if (name.length < 2 || name.length > 255) {
      return sendResponse(res, 400, 'Name must be between 2 and 255 characters');
    }

    // phone / address na aayen to purani value rehti hai
    const phone = req.body.phone_number !== undefined ? String(req.body.phone_number).trim() : current.phone_number;
    if (phone.length < 7 || phone.length > 20) return sendResponse(res, 400, 'Invalid phone number');

    const address = req.body.address !== undefined ? String(req.body.address).trim() : current.address;
    if (address && address.length > 500) return sendResponse(res, 400, 'Address must be at most 500 characters');

    await pool.query(
      'UPDATE customers SET name = ?, phone_number = ?, address = ? WHERE customer_id = ?',
      [name, phone, address, req.user.id]
    );

    const [updated] = await pool.query(`SELECT ${PROFILE_FIELDS} FROM customers WHERE customer_id = ?`, [req.user.id]);
    return sendResponse(res, 200, 'Profile updated', updated[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Update failed. Please try again.');
  }
};
