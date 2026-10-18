const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// page ≥ 1, limit 1–100, default page 1 / limit 20. Galat ho to null return karta hai
const getPagination = (query) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) return null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  return { page, limit, offset: (page - 1) * limit };
};

module.exports = { isValidEmail, getPagination };
