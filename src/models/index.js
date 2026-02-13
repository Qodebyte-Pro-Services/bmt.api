const sequelize = require('../config/db');
const Admin = require('./admin');
const { Attribute, AttributeValue } = require('./attributes');
const Category = require('./category');
const Customer = require('./customer');
const { Discount, ProductDiscount, Tax } = require('./discount');
const Expense = require('./expense');
const ExpenseCategory = require('./expenseCategory');
const LoginAttempt = require('./login-attempts');
const OTP = require('./otp');
const { Product, Variant, InventoryLog, StockNotification } = require('./product');
const Role = require('./role');
const { Order, OrderItem, OrderPayment, Report, CreditAccount, InstallmentPlan, InstallmentPayment } = require('./sales');
const Settings = require('./settings');

// ============================================
// ADMIN & ROLE ASSOCIATIONS
// ============================================

Role.hasMany(Admin, {
  foreignKey: 'admin_role',
  sourceKey: 'roles_id',
  onDelete: 'SET NULL',
  hooks: true,
});

Admin.belongsTo(Role, {
  foreignKey: 'admin_role',
  targetKey: 'roles_id',
  onDelete: 'SET NULL',
});

// ============================================
// SETTINGS ASSOCIATIONS
// ============================================

Settings.belongsTo(Admin, { 
  as: 'creator', 
  foreignKey: 'created_by',
  targetKey: 'admin_id' // Fixed: use admin_id instead of id
});

Settings.belongsTo(Admin, { 
  as: 'updater', 
  foreignKey: 'updated_by',
  targetKey: 'admin_id' // Fixed: use admin_id instead of id
});

// ============================================
// ATTRIBUTE ASSOCIATIONS
// ============================================

Attribute.hasMany(AttributeValue, { 
  foreignKey: 'attribute_id', 
  as: 'values' 
});

AttributeValue.belongsTo(Attribute, { 
  foreignKey: 'attribute_id', 
  as: 'attribute' 
});

// ============================================
// PRODUCT & CATEGORY ASSOCIATIONS
// ============================================

Product.hasMany(Variant, { 
  foreignKey: 'product_id', 
  as: 'variants' 
});

Product.belongsTo(Category, { 
  foreignKey: 'category_id', 
  as: 'category' 
});

Category.hasMany(Product, { 
  foreignKey: 'category_id', 
  as: 'products' 
});

// ============================================
// VARIANT ASSOCIATIONS
// ============================================

Variant.belongsTo(Product, { 
  foreignKey: 'product_id', 
  as: 'product' 
});

Variant.hasMany(InventoryLog, { 
  foreignKey: 'variant_id', 
  as: 'inventory_logs' 
});

Variant.hasMany(StockNotification, {
  foreignKey: 'variant_id'
});

// ============================================
// INVENTORY LOG ASSOCIATIONS
// ============================================

InventoryLog.belongsTo(Variant, { 
  foreignKey: 'variant_id', 
  as: 'variant' 
});

InventoryLog.belongsTo(Admin, { 
  foreignKey: 'recorded_by', 
  targetKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'recorded_by_admin',
  constraints: false
});

// ============================================
// STOCK NOTIFICATION ASSOCIATIONS
// ============================================

StockNotification.belongsTo(Variant, { 
  foreignKey: 'variant_id', 
  as: 'variant' 
});

// ============================================
// DISCOUNT ASSOCIATIONS
// ============================================

Product.belongsToMany(Discount, { 
  through: ProductDiscount, 
  foreignKey: 'product_id', 
  otherKey: 'discount_id',
  as: 'discounts' 
});

Discount.belongsToMany(Product, { 
  through: ProductDiscount, 
  foreignKey: 'discount_id', 
  otherKey: 'product_id',
  as: 'products' 
});

ProductDiscount.belongsTo(Product, { 
  as: 'product', 
  foreignKey: 'product_id' 
});

ProductDiscount.belongsTo(Discount, { 
  as: 'discount', 
  foreignKey: 'discount_id' 
});

Product.hasMany(ProductDiscount, { 
  as: 'productDiscounts', 
  foreignKey: 'product_id' 
});

Discount.hasMany(ProductDiscount, { 
  as: 'productDiscounts', 
  foreignKey: 'discount_id' 
});

// ============================================
// EXPENSE ASSOCIATIONS
// ============================================

Expense.belongsTo(ExpenseCategory, {
  foreignKey: 'expense_category_id', 
  as: 'expense_category' // Changed from 'category' to avoid conflicts
});

Expense.belongsTo(Admin, {
  foreignKey: 'admin_id', 
  targetKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'admin'
});

ExpenseCategory.hasMany(Expense, {
  foreignKey: 'expense_category_id',
  as: 'expenses'
});

// ============================================
// CUSTOMER & ORDER ASSOCIATIONS
// ============================================

Customer.hasMany(Order, { 
  foreignKey: "customer_id" 
});

Order.belongsTo(Customer, { 
  foreignKey: "customer_id" 
});

// ============================================
// ORDER ASSOCIATIONS
// ============================================

Order.hasMany(OrderItem, { 
  foreignKey: "order_id" 
});

OrderItem.belongsTo(Order, { 
  foreignKey: "order_id" 
});

// ============================================
// ORDER ITEM & VARIANT ASSOCIATIONS
// ============================================

Variant.hasMany(OrderItem, { 
  foreignKey: "variant_id" 
});

OrderItem.belongsTo(Variant, { 
  foreignKey: "variant_id", 
  as: "variant" 
});

// ============================================
// ORDER PAYMENT ASSOCIATIONS
// ============================================

Order.hasMany(OrderPayment, { 
  foreignKey: "order_id" 
});

OrderPayment.belongsTo(Order, { 
  foreignKey: "order_id" 
});

// ============================================
// CREDIT & INSTALLMENT ASSOCIATIONS
// ============================================

Order.hasOne(CreditAccount, {foreignKey: 'order_id', as: 'credit_account' });
CreditAccount.belongsTo(Order, {foreignKey: 'order_id'});

Order.hasOne(InstallmentPlan, {foreignKey: 'order_id', as: 'installment_plan' });
InstallmentPlan.belongsTo(Order, {foreignKey: 'order_id'});

InstallmentPlan.hasMany(InstallmentPayment, {
  foreignKey: 'installment_plan_id',
  as: 'InstallmentPayments'
});

InstallmentPayment.belongsTo(InstallmentPlan, {
  foreignKey: 'installment_plan_id'
});

// ============================================
// CUSTOMER ↔ CREDIT ACCOUNT
// ============================================

Customer.hasMany(CreditAccount, {
  foreignKey: 'customer_id',
});

CreditAccount.belongsTo(Customer, {
  foreignKey: 'customer_id',
});

// ============================================
// CUSTOMER ↔ INSTALLMENT PLAN
// ============================================

Customer.hasMany(InstallmentPlan, {
  foreignKey: 'customer_id',
});

InstallmentPlan.belongsTo(Customer, {
  foreignKey: 'customer_id',
});

// ============================================
// ORDER & ADMIN ASSOCIATIONS
// ============================================

Admin.hasMany(Order, { 
  foreignKey: "admin_id",
  targetKey: "admin_id", // Fixed: use admin_id instead of id
  as: 'orders'
});

Order.belongsTo(Admin, { 
  foreignKey: "admin_id",
  targetKey: "admin_id", // Fixed: use admin_id instead of id
  as: 'admin'
});

// ============================================
// LOGIN ATTEMPT ASSOCIATIONS
// ============================================

LoginAttempt.belongsTo(Admin, {
  foreignKey: 'admin_id',
  targetKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'requestingAdmin',
  constraints: false
});

LoginAttempt.belongsTo(Admin, {
  foreignKey: 'approved_by',
  targetKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'approverAdmin',
  constraints: false
});

Admin.hasMany(LoginAttempt, {
  foreignKey: 'admin_id',
  sourceKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'loginAttempts'
});

Admin.hasMany(LoginAttempt, {
  foreignKey: 'approved_by',
  sourceKey: 'admin_id', // Fixed: use admin_id instead of id
  as: 'approvedLoginAttempts'
});

// ============================================
// OTP ASSOCIATIONS
// ============================================

OTP.belongsTo(Admin, {
  foreignKey: 'entity_id',
  targetKey: 'admin_id', // Fixed: use admin_id instead of id
  constraints: false,
  as: 'admin'
});

OTP.belongsTo(LoginAttempt, {
  foreignKey: 'login_attempt_id',
  targetKey: 'login_attempt_id',
  as: 'loginAttempt'
});

LoginAttempt.hasMany(OTP, {
  foreignKey: 'login_attempt_id',
  as: 'otps'
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
    sequelize,
    Admin,
    Role,
    OTP,
    Settings,
    Attribute,
    AttributeValue,
    Product,
    Variant,
    Category,
    InventoryLog,
    StockNotification,
    Discount,
    ProductDiscount,
    Order,
    OrderItem,
    Customer,
    Expense, 
    ExpenseCategory,
    OrderPayment,
    Report,
    CreditAccount,
    InstallmentPlan,
    InstallmentPayment,
    Tax,
    LoginAttempt,
}