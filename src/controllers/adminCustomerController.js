// 4.4 Customers (admin)
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');
const { isValidEmail, getPagination } = require('../utils/helpers');

const FIELDS = 'customer_id, name, email, phone_number, address, created_at';

// GET /admin/customers?page=&limit=&search=
exports.listCustomers = async (req, res) => {
  try {
    const pg = getPagination(req.query);
    if (!pg) return sendResponse(res, 400, 'Invalid pagination');

    const search = req.query.search !== undefined ? String(req.query.search).trim() : '';
    if (search.length > 100) return sendResponse(res, 400, 'Search text too long (max 100 characters)');

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM customers ${where}`, params);
    const [customers] = await pool.query(
      `SELECT customer_id, name, email, phone_number, created_at
       FROM customers ${where}
       ORDER BY customer_id DESC LIMIT ? OFFSET ?`,
      [...params, pg.limit, pg.offset]
    );

    return sendResponse(res, 200, 'Customers fetched', { total, page: pg.page, customers });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch customers');
  }
};

// GET /admin/customers/:id
exports.getCustomer = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${FIELDS} FROM customers WHERE customer_id = ?`, [req.params.id]);
    if (!rows.length) return sendResponse(res, 404, 'Customer not found');
    return sendResponse(res, 200, 'Customer fetched', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch customers');
  }
};

// PUT /admin/customers/:id   body: name, email, phone_number, address
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM customers WHERE customer_id = ?', [id]);
    if (!rows.length) return sendResponse(res, 404, 'Customer not found');
    const c = rows[0];

    const name = req.body.name !== undefined ? String(req.body.name).trim() : c.name;
    if (name.length < 2 || name.length > 255) {
      return sendResponse(res, 400, 'Name must be between 2 and 255 characters');
    }

    const email = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : c.email;
    if (!isValidEmail(email)) return sendResponse(res, 400, 'Invalid email format');
    if (email !== c.email) {
      const [dup] = await pool.query('SELECT customer_id FROM customers WHERE email = ? AND customer_id <> ?', [email, id]);
      if (dup.length) return sendResponse(res, 409, 'Email already registered');
    }

    const phone = req.body.phone_number !== undefined ? String(req.body.phone_number).trim() : c.phone_number;
    if (phone.length < 7 || phone.length > 20) return sendResponse(res, 400, 'Invalid phone number');

    const address = req.body.address !== undefined ? String(req.body.address).trim() : c.address;
    if (address && address.length > 500) return sendResponse(res, 400, 'Address must be at most 500 characters');

    await pool.query(
      'UPDATE customers SET name = ?, email = ?, phone_number = ?, address = ? WHERE customer_id = ?',
      [name, email, phone, address, id]
    );

    const [updated] = await pool.query(`SELECT ${FIELDS} FROM customers WHERE customer_id = ?`, [id]);
    return sendResponse(res, 200, 'Customer updated', updated[0]);
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return sendResponse(res, 409, 'Email already registered');
    return sendResponse(res, 500, 'Could not update customer');
  }
};

// DELETE /admin/customers/:id   (carts/cart_items/wishlists cascade se delete; orders hon to 409)
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT customer_id FROM customers WHERE customer_id = ?', [id]);
    if (!rows.length) return sendResponse(res, 404, 'Customer not found');

    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ?', [id]);
    if (cnt > 0) return sendResponse(res, 409, 'Cannot delete customer with orders');

    await pool.query('DELETE FROM customers WHERE customer_id = ?', [id]);
    return sendResponse(res, 200, 'Customer deleted');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not delete customer');
  }
};
