// Pehla admin banane ke liye (kyunki POST /admin/register ko admin token chahiye)
// Usage: npm run seed:admin -- "Admin Name" admin@example.com password123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

(async () => {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.log('Usage: npm run seed:admin -- "Name" email password');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO admin (name, email, password) VALUES (?, ?, ?)', [
      name, email.toLowerCase(), hash,
    ]);
    console.log('Admin created with id', r.insertId);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    await pool.end();
  }
})();
