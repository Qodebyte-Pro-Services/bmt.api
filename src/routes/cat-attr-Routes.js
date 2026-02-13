const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const AttributeController = require('../controllers/attributeController');
const { requirePermission } = require('../utils/routeHelper');
const { CATEGORY_ATTRIBUTE_PERMISSIONS } = require('../constants/permissions');

router.post(
  '/categories',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_CATEGORIES),
  CategoryController.createCategory
);

router.post(
  '/attributes',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.createAttribute
);


router.post(
  '/attributes/bulk',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.createAttributesBulk
);

router.post(
  '/attributes/:id/values',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.addAttributeValue
);

router.get(
  '/categories',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_CATEGORIES),
  CategoryController.getAllCategories
);

router.get(
  '/attributes',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.getAllAttributes
);


router.get(
  '/attributes/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.getAttributeAndValuesById
);

router.get(
  '/categories/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_CATEGORIES),
  CategoryController.getProductsForCategory
);


router.put(
  '/attributes/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.updateAttribute
);

router.put(
  '/categories/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_CATEGORIES),
  CategoryController.updateCategory
);

router.put(
  '/attributes/:id/values/:value_id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.UpdateAttributeValue
);

router.delete(
  '/attributes/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.deleteAttribute
);

router.delete(
  '/attributes/:id/values/:value_id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_ATTRIBUTES),
  AttributeController.deleteAttributeValue
);

router.delete(
  '/categories/:id',
  ...requirePermission(CATEGORY_ATTRIBUTE_PERMISSIONS.MANAGE_CATEGORIES),
  CategoryController.deleteCategory
);


module.exports = router;