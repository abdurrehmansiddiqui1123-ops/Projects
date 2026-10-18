const jwt = require("jsonwebtoken");
const { sendResponse } = require("../utils/response");

// Token header se aata hai:  token: <jwt>
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

  if (!token) return sendResponse(res, 401, "Unauthorized");

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role }
    next();
  } catch (err) {
    return sendResponse(res, 401, "Unauthorized");
  }
};

// allowRoles('customer') / allowRoles('customer','admin') / allowRoles('admin')
const allowRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return sendResponse(res, 403, "Forbidden");
    next();
  };

module.exports = { verifyToken, allowRoles };
