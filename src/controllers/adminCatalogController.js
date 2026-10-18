// 4.2 Categories + 4.3 Products (admin)
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/response');
const { getPagination } = require('../utils/helpers');

/* ------------------------- Categories ------------------------- */

// POST /admin/categories   body: name, description
exports.createCategory = async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const description = req.body.description ?? null;

    if (!name) return sendResponse(res, 400, 'Name is required');
    if (name.length < 2 || name.length > 255) {
      return sendResponse(res, 400, 'Name must be between 2 and 255 characters');
    }

    const [dup] = await pool.query('SELECT category_id FROM categories WHERE name = ?', [name]);
    if (dup.length) return sendResponse(res, 409, 'Category already exists');

    const [result] = await pool.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    return sendResponse(res, 201, 'Category created', { category_id: result.insertId, name, description });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return sendResponse(res, 409, 'Category already exists');
    return sendResponse(res, 500, 'Could not create category');
  }
};

// PUT /admin/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM categories WHERE category_id = ?', [id]);
    if (!rows.length) return sendResponse(res, 404, 'Category not found');
    const current = rows[0];

    let name = current.name;
    if (req.body.name !== undefined) {
      name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 255) {
        return sendResponse(res, 400, 'Name must be between 2 and 255 characters');
      }
      const [dup] = await pool.query(
        'SELECT category_id FROM categories WHERE name = ? AND category_id <> ?',
        [name, id]
      );
      if (dup.length) return sendResponse(res, 409, 'Category already exists');
    }
    const description = req.body.description !== undefined ? req.body.description : current.description;

    await pool.query('UPDATE categories SET name = ?, description = ? WHERE category_id = ?', [name, description, id]);

    const [updated] = await pool.query(
      'SELECT category_id, name, description, created_at FROM categories WHERE category_id = ?',
      [id]
    );
    return sendResponse(res, 200, 'Category updated', updated[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not update category');
  }
};

// DELETE /admin/categories/:id   (products ka category_id NULL ho jata hai)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [id]);
    if (!rows.length) return sendResponse(res, 404, 'Category not found');

    await pool.query('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
    await pool.query('DELETE FROM categories WHERE category_id = ?', [id]);
    return sendResponse(res, 200, 'Category deleted');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not delete category');
  }
};

/* ------------------------- Products ------------------------- */

const hasValue = (v) => v !== undefined && v !== null && v !== '';

function parseIsActive(value) {
  if (value === undefined || value === null) return 1;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return 1;
    if (normalized === 'false') return 0;
  }
  return null;
}

// Product data check karta hai. Galat ho to [status, message], sahi ho to null
function validateProduct(p) {
  if (!p.name || String(p.name).trim() === '') return [400, 'Name is required'];

  const price = Number(p.price);
  if (!hasValue(p.price) || isNaN(price) || price <= 0) return [400, 'Price must be greater than 0'];

  if (hasValue(p.discount_price)) {
    const dp = Number(p.discount_price);
    if (isNaN(dp) || dp < 0 || dp >= price) return [400, 'Discount price must be less than price'];
  }
  if (hasValue(p.discount_percent)) {
    const d = Number(p.discount_percent);
    if (isNaN(d) || d < 0 || d > 100) return [400, 'Discount percent must be between 0 and 100'];
  }

  const stock = Number(p.stock_quantity);
  if (!hasValue(p.stock_quantity) || !Number.isInteger(stock) || stock < 0) {
    return [400, 'Invalid stock quantity'];
  }
  if (parseIsActive(p.is_active) === null) {
    return [400, 'is_active must be a boolean or 0/1'];
  }
  return null;
}

// DB mein jaane wali clean values
function normalizeProduct(p) {
  const price = Number(p.price);
  const discount_price = hasValue(p.discount_price) ? Number(p.discount_price) : null;
  const discount_percent = hasValue(p.discount_percent) ? Number(p.discount_percent) : 0;
  return {
    category_id: hasValue(p.category_id) ? Number(p.category_id) : null,
    name: String(p.name).trim(),
    description: p.description ?? null,
    price,
    discount_price,
    discount_percent,
    stock_quantity: Number(p.stock_quantity),
    image_url: p.image_url ?? null,
    is_active: parseIsActive(p.is_active),
  };
}

const PRODUCT_SELECT = `
  SELECT p.product_id, p.category_id, c.name AS category_name, p.name, p.description,
         p.price, p.discount_price, p.discount_percent, p.stock_quantity, p.image_url, p.is_active
  FROM products p
  LEFT JOIN categories c ON c.category_id = p.category_id`;

const LIST_SELECT = `
  SELECT p.product_id, p.category_id, c.name AS category_name, p.name,
         p.price, p.discount_price, p.discount_percent, p.stock_quantity, p.image_url, p.is_active
  FROM products p
  LEFT JOIN categories c ON c.category_id = p.category_id`;

// GET /admin/products?category_id=&is_active=&page=&limit=
exports.listProducts = async (req, res) => {
  try {
    const pg = getPagination(req.query);
    if (!pg) return sendResponse(res, 400, 'Invalid pagination');

    const where = [];
    const params = [];

    if (req.query.category_id !== undefined) {
      where.push('p.category_id = ?');
      params.push(req.query.category_id);
    }
    if (req.query.is_active !== undefined) {
      if (!['0', '1'].includes(String(req.query.is_active))) {
        return sendResponse(res, 400, 'Invalid is_active value');
      }
      where.push('p.is_active = ?');
      params.push(Number(req.query.is_active));
    }

    const sql =
      LIST_SELECT +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY p.product_id DESC LIMIT ? OFFSET ?';

    const [rows] = await pool.query(sql, [...params, pg.limit, pg.offset]);
    return sendResponse(res, 200, 'Products fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch products');
  }
};

// POST /admin/products
exports.createProduct = async (req, res) => {
  try {
    const error = validateProduct(req.body);
    if (error) return sendResponse(res, error[0], error[1]);

    const p = normalizeProduct(req.body);

    if (p.category_id !== null) {
      const [cat] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [p.category_id]);
      if (!cat.length) return sendResponse(res, 404, 'Category not found');
    }

    const [result] = await pool.query(
      `INSERT INTO products
         (category_id, name, description, price, discount_price, discount_percent, stock_quantity, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.category_id, p.name, p.description, p.price, p.discount_price, p.discount_percent,
       p.stock_quantity, p.image_url, p.is_active]
    );

    const [rows] = await pool.query(PRODUCT_SELECT + ' WHERE p.product_id = ?', [result.insertId]);
    return sendResponse(res, 201, 'Product created', rows[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not create product');
  }
};

// GET /admin/products/low-stock?threshold=   (default 5)
exports.lowStock = async (req, res) => {
  try {
    const threshold = req.query.threshold === undefined ? 5 : Number(req.query.threshold);
    if (isNaN(threshold) || threshold < 0) return sendResponse(res, 400, 'Invalid threshold');

    const [rows] = await pool.query(
      'SELECT product_id, name, stock_quantity FROM products WHERE stock_quantity <= ? ORDER BY stock_quantity ASC',
      [threshold]
    );
    return sendResponse(res, 200, 'Low stock products fetched', rows);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not fetch low stock products');
  }
};

// PUT /admin/products/:id   (body mein jo fields aayen sirf wahi badalte hain)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [id]);
    if (!rows.length) return sendResponse(res, 404, 'Product not found');

    const merged = { ...rows[0], ...req.body };

    const error = validateProduct(merged);
    if (error) return sendResponse(res, error[0], error[1]);

    const p = normalizeProduct(merged);

    if (req.body.category_id !== undefined && p.category_id !== null) {
      const [cat] = await pool.query('SELECT category_id FROM categories WHERE category_id = ?', [p.category_id]);
      if (!cat.length) return sendResponse(res, 404, 'Category not found');
    }

    await pool.query(
      `UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, discount_price = ?,
         discount_percent = ?, stock_quantity = ?, image_url = ?, is_active = ?
       WHERE product_id = ?`,
      [p.category_id, p.name, p.description, p.price, p.discount_price, p.discount_percent,
       p.stock_quantity, p.image_url, p.is_active, id]
    );

    const [updated] = await pool.query(PRODUCT_SELECT + ' WHERE p.product_id = ?', [id]);
    return sendResponse(res, 200, 'Product updated', updated[0]);
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not update product');
  }
};

// DELETE /admin/products/:id   (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT product_id FROM products WHERE product_id = ?', [req.params.id]);
    if (!rows.length) return sendResponse(res, 404, 'Product not found');

    await pool.query('UPDATE products SET is_active = 0 WHERE product_id = ?', [req.params.id]);
    return sendResponse(res, 200, 'Product deleted');
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, 'Could not delete product');
  }
};
