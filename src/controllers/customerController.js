

const { Customer, OrderItem, OrderPayment, CreditAccount, InstallmentPlan, InstallmentPayment, Order, Variant} = require("../models");


exports.addCustomer = async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    const customer = await Customer.create({
      name,
      phone: phone || null,
      email: email || null,
    });

    return res.status(201).json({ customer });
  } catch (err) {
    console.error("❌ Add customer error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Customer.findAndCountAll({
      where: {
        is_deleted: false, 
      },
      attributes: { exclude: ["password"] },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.status(200).json({
      customers: rows,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      limit,
    });
  } catch (err) {
    console.error("List customers error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};


exports.getCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({
      where: {
        id,
        is_deleted: false, 
      },
      attributes: { exclude: ["password"] },
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    return res.status(200).json({ customer });
  } catch (err) {
    console.error("Get customer error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};


exports.getCustomerTransactions = async (req, res) => {
  try {
    const { id: customerId } = req.params;

    const orders = await Order.findAll({
      where: { customer_id: customerId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: OrderItem,
          include: [{ model: Variant, as: 'variant' }],
        },
        {
          model: OrderPayment,
        },
        {
          model: CreditAccount,
        },
        {
          model: InstallmentPlan,
          include: [InstallmentPayment],
        },
      ],
    });

    const transactions = orders.map(order => {
      const payments = order.OrderPayments || [];
      const credit = order.CreditAccount;
      const installment = order.InstallmentPlan;

      const amountPaid = payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      let paymentMethod = 'cash';

      if (credit) paymentMethod = 'credit';
      else if (installment) paymentMethod = 'installment';
      else if (payments.length > 1) paymentMethod = 'split';
      else if (payments.length === 1) paymentMethod = payments[0].method;

      return {
        id: order.id,
        timestamp: order.createdAt,
        total: Number(order.total_amount),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax_total),
        paymentMethod,
        amountPaid,
        purchaseType: order.purchase_type,
        items: order.OrderItems.map(i => ({
          id: i.id,
          name: i.variant?.name,
          quantity: i.quantity,
          price: Number(i.unit_price),
          total: Number(i.total_price),
        })),
        installmentPlan: installment
          ? {
              totalAmount: Number(installment.total_amount),
              remainingBalance: Number(installment.remaining_balance),
              status: installment.status,
              payments: installment.InstallmentPayments,
            }
          : null,
      };
    });

    res.json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('❌ getCustomerTransactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params; 
    const { name, phone, email } = req.body;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    const updates = {};
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
   
    await customer.update(updates);

    return res.status(200).json({
      message: "Customer updated successfully by admin.",
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });
  } catch (err) {
    console.error("❌ Update customer by admin error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findByPk(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    await customer.update({
      is_deleted: true,
      deleted_at: new Date(),
    });

    return res.status(200).json({
      message: "Customer deleted successfully."
    });
  } catch (err) {
    console.error("❌ Delete customer error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};


