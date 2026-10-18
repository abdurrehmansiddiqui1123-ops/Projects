const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, checkConnection } = require("../config/db");
const { sendResponse } = require("../utils/response");
const { isValidEmail } = require("../utils/helpers");

const createToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// GET /check-db
exports.checkDb = async (req, res) => {
  try {
    await checkConnection();
    return sendResponse(res, 200, "Database connected successfully");
  } catch (err) {
    return sendResponse(res, 500, "Database connection failed");
  }
};

// POST /register
exports.register = async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(req.body.phone ?? "").trim();
    const password = String(req.body.password ?? "");

    if (!name || !email || !phone || !password) {
      return sendResponse(
        res,
        400,
        "Name, email, phone, and password are required",
      );
    }
    if (!isValidEmail(email))
      return sendResponse(res, 400, "Invalid email format");
    if (password.length < 6) {
      return sendResponse(res, 400, "Password must be at least 6 characters");
    }

    const [existing] = await pool.execute(
      "SELECT customer_id FROM customers WHERE email = ?",
      [email],
    );
    if (existing.length) {
      return sendResponse(res, 409, "Email already registered. Please login.");
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO customers (name, email, phone_number, password) VALUES (?, ?, ?, ?)",
      [name, email, phone, hash],
    );

    return sendResponse(res, 201, "Registration successful", {
      customer_id: result.insertId,
      name,
      email,
      phone_number: phone,
    });
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return sendResponse(res, 409, "Email already registered. Please login.");
    }
    return sendResponse(res, 500, "Registration failed. Please try again.");
  }
};

// POST /login
exports.login = async (req, res) => {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");

    if (!email || !password)
      return sendResponse(res, 400, "Email and password are required");

    const [rows] = await pool.query("SELECT * FROM customers WHERE email = ?", [
      email,
    ]);
    if (!rows.length)
      return sendResponse(res, 401, "Invalid email or password");

    const customer = rows[0];
    const match = await bcrypt.compare(password, customer.password);
    if (!match) return sendResponse(res, 401, "Invalid email or password");

    // token response mein top-level pe aata hai, data ke bahar
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        customer_id: customer.customer_id,
        name: customer.name,
        email: customer.email,
        phone_number: customer.phone_number,
      },
      token: createToken(customer.customer_id),
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, "Login failed. Please try again.");
  }
};

// POST /admin-login
exports.adminLogin = async (req, res) => {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");

    if (!email || !password)
      return sendResponse(res, 400, "Email and password are required");

    const [rows] = await pool.query("SELECT * FROM admin WHERE email = ?", [
      email,
    ]);
    if (!rows.length)
      return sendResponse(res, 401, "Invalid admin email or password");

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return sendResponse(res, 401, "Invalid admin email or password");

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: { admin_id: admin.admin_id, name: admin.name, email: admin.email },
      token: createToken(admin.admin_id, "admin"),
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, "Login failed. Please try again.");
  }
};
