const router = require('express').Router();
const { verifyToken, allowRoles } = require('../middleware/auth');
const catalog = require('../controllers/catalogController');

const shared = [verifyToken, allowRoles('customer', 'admin')];

router.get('/categories', shared, catalog.getCategories);
router.get('/categories/:id', shared, catalog.getCategoryById);
router.get('/products', shared, catalog.getProducts);
router.get('/products/:id', shared, catalog.getProductById);

module.exports = router;
