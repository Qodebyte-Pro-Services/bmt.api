const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const discountController = require('../controllers/discountControllers');
const taxController = require('../controllers/taxControllers');
const { requirePermission } = require('../utils/routeHelper');
const { SALES_PERMISSIONS, DISCOUNT_PERMISSIONS, TAX_PERMISSIONS } = require('../constants/permissions');

router.post(
  '/',
  ...requirePermission(SALES_PERMISSIONS.CREATE_SALE),
  saleController.createSale
);

router.post(
  '/installment/pay',
  ...requirePermission(SALES_PERMISSIONS.CREATE_SALE),
  saleController.payInstallment
);

router.post(
  '/discounts',
  ...requirePermission(DISCOUNT_PERMISSIONS.CREATE_DISCOUNT),
  discountController.createDiscount
);

router.post(
  '/discounts/link',
  ...requirePermission(DISCOUNT_PERMISSIONS.LINK_DISCOUNT),
  discountController.LinkDiscountTOProduct
);

router.post(
  '/taxes',
  ...requirePermission(TAX_PERMISSIONS.CREATE_TAX),
  taxController.createTax
);

router.get(
  '/discounts',
  ...requirePermission(DISCOUNT_PERMISSIONS.VIEW_DISCOUNTS),
  discountController.getDiscounts
);

router.get(
  '/discounts/links/all',
  ...requirePermission(DISCOUNT_PERMISSIONS.VIEW_DISCOUNTS),
  discountController.getListOfLinks
);

router.get(
  '/installments/all',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getAllInstallmentPlans
);

router.get(
  '/reports/generate',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  saleController.salesReport
);

router.get(
  '/taxes',
  ...requirePermission(TAX_PERMISSIONS.VIEW_TAXES),
  taxController.getTaxRate
);


router.get(
  '/',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getSales
);


router.get(
  '/installments/customer/:customerId',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getCustomerInstallments
);


router.get(
  '/installment/transaction/:paymentId',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getInstallmentTransaction
);

router.get(
  '/reports/status/:reportId',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  saleController.reportStatus
);


router.get(
  '/installments/:id',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getInstallmentPlanById
);

router.get(
  '/reports/download/:reportId',
  ...requirePermission(SALES_PERMISSIONS.VIEW_ANALYTICS),
  saleController.downloadReport
);

router.put(
  '/discounts/:id',
  ...requirePermission(DISCOUNT_PERMISSIONS.UPDATE_DISCOUNT),
  discountController.updateDiscount
);

router.put(
  '/taxes/:id',
  ...requirePermission(TAX_PERMISSIONS.UPDATE_TAX),
  taxController.updateTaxRate
);


router.get(
  '/:id',
  ...requirePermission(SALES_PERMISSIONS.VIEW_SALES),
  saleController.getSaleById
);


router.delete(
  '/discounts/:id',
  ...requirePermission(DISCOUNT_PERMISSIONS.DELETE_DISCOUNT),
  discountController.deleteAndUnlinkDiscountAndProduct
);

router.delete(
  '/taxes/:id',
  ...requirePermission(TAX_PERMISSIONS.DELETE_TAX),
  taxController.deleteTax
);


module.exports = router