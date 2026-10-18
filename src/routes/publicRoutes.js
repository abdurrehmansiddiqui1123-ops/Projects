const router = require('express').Router();
const auth = require('../controllers/authController');

router.get('/check-db', auth.checkDb);
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/admin-login', auth.adminLogin);

module.exports = router;
