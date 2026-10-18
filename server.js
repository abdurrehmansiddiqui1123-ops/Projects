require('dotenv').config();
const app = require('./src/app');
const { checkConnection } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await checkConnection();
    console.log('MySQL connected');
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
  }
});
