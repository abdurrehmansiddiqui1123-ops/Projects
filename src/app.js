const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sendResponse } = require('./utils/response');
const publicRoutes = require('./routes/publicRoutes');
const sharedRoutes = require('./routes/sharedRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (!req.body) req.body = {}; // body na ho to bhi req.body.x crash na kare
  next();
});

app.use('/', publicRoutes);
app.use('/', sharedRoutes);
app.use('/', customerRoutes);
app.use('/admin', adminRoutes);

// Koi route match na ho
app.use((req, res) => sendResponse(res, 404, 'Route not found'));

// Global error handler (jaise galat JSON body)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return sendResponse(res, 400, 'Invalid JSON body');
  console.error(err);
  return sendResponse(res, 500, 'Something went wrong');
});

module.exports = app;
