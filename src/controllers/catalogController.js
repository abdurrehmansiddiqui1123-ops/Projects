// Shared routes: customer aur admin dono (token + role customer/admin)
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');

// GET /categories
exports.getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT category_id, name, description FROM categories ORDER BY name'
    );
    return sendResponse(res, 200, 'Categories fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch categories');
  }
};

// GET /categories/:id
exports.getCategoryById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT category_id, name, description, created_at FROM categories WHERE category_id = ?',
      [req.params.id]
    );
    if (!rows.length) return sendResponse(res, 404, 'Category not found');
    return sendResponse(res, 200, 'Category fetched', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch categories');
  }
};

// GET /products?category_id=
exports.getProducts = async (req, res) => {
  try {
    let sql = `
      SELECT p.product_id, p.category_id, c.name AS category_name, p.name, p.description,
             p.price, p.discount_price, p.discount_percent, p.stock_quantity,
             p.image_url, p.is_active
      FROM products p
      LEFT JOIN categories c ON c.category_id = p.category_id
      WHERE p.is_active = 1`;
    const params = [];

    // category_id di gayi ho AUR exist kare tabhi filter; warna sab products
    const { category_id } = req.query;
    if (category_id) {
      const [cat] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [category_id]);
      if (cat.length) {
        sql += ' AND p.category_id = ?';
        params.push(category_id);
      }
    }
    sql += ' ORDER BY p.product_id DESC';

    const [rows] = await pool.query(sql, params);
    return sendResponse(res, 200, 'Products fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch products');
  }
};

// GET /products/:id
exports.getProductById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.product_id, p.category_id, c.name AS category_name, p.name, p.description,
              p.price, p.discount_price, p.discount_percent, p.stock_quantity, p.image_url
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE p.product_id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (!rows.length) return sendResponse(res, 404, 'Product not found');
    return sendResponse(res, 200, 'Product fetched', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch products');
  }
};
