const express = require('express');
const router = express.Router();
const productController = require('../controllers/productControllers');
const variantController = require('../controllers/variantControllers');
const inventoryController = require('../controllers/inventoryControllers');
const stockNotificationService = require('../services/stockNotifications');
const {requirePermission } = require('../utils/routeHelper');
const { PRODUCT_PERMISSIONS, INVENTORY_MGT_PERMISSIONS } = require('../constants/permissions');
const { upload } = require('../utils/uploads');

router.post(
  '/',
  ...requirePermission(PRODUCT_PERMISSIONS.CREATE_PRODUCT),
  upload.array('product_main_image'),
  productController.createProduct
);


router.post(
  '/with-variants',
  ...requirePermission(PRODUCT_PERMISSIONS.CREATE_PRODUCT),
  upload.fields([
    { name: 'product_main_image', maxCount: 1 },
    { name: 'product_additional_image_', maxCount: 10 },
    { name: 'variants[0][image_url]', maxCount: 5 },
    { name: 'variants[1][image_url]', maxCount: 5 },
    { name: 'variants[2][image_url]', maxCount: 5 },
    { name: 'variants[3][image_url]', maxCount: 5 },
    { name: 'variants[4][image_url]', maxCount: 5 }
  ]),
  productController.createProductWithVariants
);

router.post(
  '/:id/variants/generate',
  ...requirePermission(PRODUCT_PERMISSIONS.CREATE_PRODUCT_VARIANTS),
  upload.fields([
    { name: 'variants[0][image_url]', maxCount: 5 },
    { name: 'variants[1][image_url]', maxCount: 5 },
    { name: 'variants[2][image_url]', maxCount: 5 },
    { name: 'variants[3][image_url]', maxCount: 5 },
    { name: 'variants[4][image_url]', maxCount: 5 }
  ]),
  variantController.generateVariants
);


router.post(
  '/generate-names',
  ...requirePermission(PRODUCT_PERMISSIONS.MANAGE_VARIANTS),
  variantController.generateVariantNames
);

router.post(
  '/scan/barcode',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.scanBarcode
);

router.post(
  '/adjust',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.ADJUST_INVENTORY),
  inventoryController.adjustStock
);

router.get(
  '/movements',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  inventoryController.getStockMovements
);

router.get(
  '/list-simple',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.listVariantsWithProduct
);

router.get(
  '/variants/list',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.listVariantsWithAllDetails
);

router.get(
  '/notifications/unread',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const notifications = await stockNotificationService.getUnreadNotifications(Number(limit));
      return res.status(200).json({
        notifications,
        count: notifications.length
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

router.put(
  '/notifications/:id/read',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  async (req, res) => {
    try {
      const { id } = req.params;
      const user_id = req.user.admin_id;
      
      await stockNotificationService.markAsRead(id, user_id);
      
      return res.status(200).json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);
router.get(
  '/notifications/stats',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  async (req, res) => {
    try {
      const stats = await stockNotificationService.getNotificationStats();
      return res.status(200).json({
        stats
      });
    } catch (err) {
      console.error('Error fetching notification stats:', err);
      return res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

router.get(
  '/movements/:product_id',
  ...requirePermission(INVENTORY_MGT_PERMISSIONS.VIEW_INVENTORY),
  inventoryController.getProductStockMovements
);



router.get(
  '/',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCTS),
  productController.listProducts
);

router.get(
  '/list/:product_id',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.ListVariants
);

router.get(
  '/detail/:id',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.getVariant
);

router.get(
  '/barcode/:barcode',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.getVariantByBarcode
);


router.get(
  '/search/:barcode_query',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT_VARIANTS),
  variantController.searchVariantsByBarcode
);

router.get(
  '/:id',
  ...requirePermission(PRODUCT_PERMISSIONS.VIEW_PRODUCT),
  productController.ProductWithVariants
);



router.put(
  '/:id',
  ...requirePermission(PRODUCT_PERMISSIONS.UPDATE_PRODUCT),
  upload.array('image_url'),
  productController.updateProducts
);


router.put(
  '/variants/:id',
  ...requirePermission(PRODUCT_PERMISSIONS.UPDATE_PRODUCT_VARIANTS),
  upload.array('image_url'),
  variantController.updateVariant
);

router.delete(
  '/:id',
  ...requirePermission(PRODUCT_PERMISSIONS.DELETE_PRODUCT),
  productController.deleteProduct
);

router.delete(
  '/variants/:variant_id',
  ...requirePermission(PRODUCT_PERMISSIONS.DELETE_PRODUCT_VARIANTS),
  variantController.deleteVariant
);


module.exports = router;