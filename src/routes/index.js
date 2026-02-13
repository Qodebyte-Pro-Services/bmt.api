
const express = require('express'); 


const router = express.Router();


router.get('/', (req, res) => {
  res.send('Welcome to the API For BMT Big Men Transaction App!');
});

router.use('/auth', require('./adminRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/sales', require('./saleRoutes'));
router.use('/roles', require('./roleRoutes'));
router.use('/settings', require('./settingsRoutes'));
router.use('/configure', require('./cat-attr-Routes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/customers', require('./customerRoutes'));
router.use('/analytics', require('./analyticsRoutes'));

module.exports = router;