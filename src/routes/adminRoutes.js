const router = require('express').Router();
const { verifyToken, allowRoles } = require('../middleware/auth');
const admin = require('../controllers/adminController');
const catalog = require('../controllers/adminCatalogController');
const customers = require('../controllers/adminCustomerController');
const orders = require('../controllers/adminOrderController');

// /admin ke neeche ke saare routes sirf admin token se
router.use(verifyToken, allowRoles('admin'));

// 4.1 Account
router.get('/me', admin.getMe);
router.post('/register', admin.registerAdmin); // second ya us se age hum jitne bhi admin  banaye gey

// 4.2 Categories
router.post('/categories', catalog.createCategory);
router.put('/categories/:id', catalog.updateCategory);
router.delete('/categories/:id', catalog.deleteCategory);

// 4.3 Products  (low-stock ko /:id wale routes se pehle rakha hai)
router.get('/products', catalog.listProducts);
router.get('/products/low-stock', catalog.lowStock);
router.post('/products', catalog.createProduct);
router.put('/products/:id', catalog.updateProduct);
router.delete('/products/:id', catalog.deleteProduct);

// 4.4 Customers
router.get('/customers', customers.listCustomers);
router.get('/customers/:id', customers.getCustomer);
router.put('/customers/:id', customers.updateCustomer);
router.delete('/customers/:id', customers.deleteCustomer);

// 4.5 Orders
router.get('/orders', orders.listOrders);
router.get('/orders/:id', orders.getOrder);
router.put('/orders/:id/status', orders.updateStatus);
router.put('/orders/:id/payment-status', orders.updatePaymentStatus);
router.delete('/orders/:id', orders.deleteOrder);

// 4.6 Dashboard
router.get('/stats', admin.getStats);

module.exports = router;
