
const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/db");



class Order extends Model {}

    Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

  customer_id: {
  type: DataTypes.UUID, 
  references: {
    model: "customers",
    key: "id",
  },
  onDelete: "SET NULL",
  allowNull: true,
},

    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("pending", "completed", "canceled", "paid", ),
      defaultValue: "pending",
    },


    source: {
      type: DataTypes.STRING(20),
      defaultValue: "pos",
    },

    purchase_type: {
      type: DataTypes.ENUM("in_store", "online_order"),
      allowNull: false,
      defaultValue: "in_store",
    },

    admin_id: { type: DataTypes.UUID, allowNull: false },

    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    tax_total: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    discount_total: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
    timestamps: true,
  }
);

class OrderItem extends Model {}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "orders",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    variant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "variants",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    total_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "OrderItem",
    tableName: "order_items",
    timestamps: false,
  }
);

class OrderPayment extends Model {}

OrderPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "orders",
        key: "id",
      },
      onDelete: "CASCADE",
    },

    method: {
      type: DataTypes.ENUM(
        'cash',
        'card',
        'transfer',
        'credit',
        'installment'
      ),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM('paid', 'pending'),
      defaultValue: 'paid',
    },

    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "OrderPayment",
    tableName: "order_payments",
  }
);

class InstallmentPlan extends Model {}

InstallmentPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },

    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    down_payment: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    remaining_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    number_of_payments: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payment_frequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly'),
      allowNull: false,
    },

    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('active', 'completed', 'defaulted'),
      defaultValue: 'active',
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "InstallmentPlan",
    tableName: "installment_plans",
  }
);

class InstallmentPayment extends Model {}

InstallmentPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    installment_plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    payment_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM('pending', 'paid', 'late'),
      defaultValue: 'pending',
    },

    method: {
      type: DataTypes.ENUM(
        'cash',
        'card',
        'transfer'),

      defaultValue: 'cash',
    },

    type: {
      type: DataTypes.ENUM('down_payment', 'installment'),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "InstallmentPayment",
    tableName: "installment_payments",
  }
);


class CreditAccount extends Model {}

CreditAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "orders",
        key: "id",
      },
    },

    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },

    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    amount_paid: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    credit_type: {
      type: DataTypes.ENUM('full', 'partial'),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('settled'),
      defaultValue: 'settled',
    },

    issued_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "CreditAccount",
    tableName: "credit_accounts",
  }
);



class Report extends Model {}

Report.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
  created_by: {
  type: DataTypes.STRING(50),
},
    params: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    format: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    result_path: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
     processing_started_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When processing started'
  },
  processing_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When processing completed'
  }
  },
{
  sequelize,
  modelName: 'Report',
  tableName: 'reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['created_by'] },
    { fields: ['created_at'] }
  ]
});

module.exports = { Report };






module.exports = {Order, OrderItem, OrderPayment, Report, InstallmentPlan, InstallmentPayment, CreditAccount};
