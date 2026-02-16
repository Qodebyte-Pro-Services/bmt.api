
const { Customer, OrderPayment, OrderItem, Variant, InventoryLog,Order, Report,  Product, Category, sequelize, CreditAccount, InstallmentPlan, InstallmentPayment, Admin } = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const validator = require('validator');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDateRange } = require('../utils/analtyicsHelper');
const { validateSalesReportQuery } = require("../utils/reportValidation");
const { buildSalesReport } = require("../services/salesReport");

exports.createSale = async (req, res) => {
  const round = (n) => Number(Number(n).toFixed(2));

  try {
    const order = await sequelize.transaction(async (t) => {
      const {
        customer_id,
        customer,
        items,
        payments = [],
        credit,
        installment,
        discount = 0,
        coupon = 0,
        taxes = 0,
        note,
      } = req.body;

      const admin_id = req.user.admin_id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error("Sale must contain at least one item");
      }

     
      let customerId = customer_id || null;

      if (!customerId && !customer) {
        let walkIn = await Customer.findOne({
          where: { [Op.or]: [{ is_walk_in: true }, { name: "Walk-in" }] },
          transaction: t,
        });

        if (!walkIn) {
          walkIn = await Customer.create(
            { name: "Walk-in", is_walk_in: true },
            { transaction: t }
          );
        }
        customerId = walkIn.id;
      }

      if (!customerId && customer) {
        if (customer.is_walk_in || customer.name?.toLowerCase() === "walk-in") {
          const walkIn = await Customer.findOne({
            where: { [Op.or]: [{ is_walk_in: true }, { name: "Walk-in" }] },
            transaction: t,
          });
          customerId = walkIn
            ? walkIn.id
            : (await Customer.create(
                { name: "Walk-in", is_walk_in: true },
                { transaction: t }
              )).id;
        } else {
          customerId = (await Customer.create(customer, { transaction: t })).id;
        }
      }

      
      let subtotal = 0;
      let tax_total = Number(taxes);
      let discount_total = Number(discount);
      let coupon_total = Number(coupon);

      for (const item of items) {
        const itemTotal =
          Number(item.total_price) ||
          Number(item.unit_price) * Number(item.quantity);

        subtotal += itemTotal;

        if (Array.isArray(item.taxes)) {
          tax_total += item.taxes.reduce((s, t) => s + Number(t.amount || 0), 0);
        }
        if (Array.isArray(item.discounts)) {
          discount_total += item.discounts.reduce(
            (s, d) => s + Number(d.amount || 0),
            0
          );
        }
        if (Array.isArray(item.coupons)) {
          coupon_total += item.coupons.reduce(
            (s, c) => s + Number(c.amount || 0),
            0
          );
        }
      }

      subtotal = round(subtotal);
      tax_total = round(tax_total);
      discount_total = round(discount_total);
      coupon_total = round(coupon_total);

      const total_amount = round(
        subtotal + tax_total - discount_total - coupon_total
      );

      const paid_amount = round(
        payments.reduce((s, p) => s + Number(p.amount || 0), 0)
      );

      
      if (installment) {
        const down = round(
          installment.downPayment || installment.down_payment
        );
        if (paid_amount !== down) throw new Error("Down payment mismatch");
      }

      if (credit) {
        const type = credit.creditType || credit.type;
        if (type === "full" && paid_amount > 0)
          throw new Error("Full credit cannot have upfront payment");
        if (type === "partial" && paid_amount >= total_amount)
          throw new Error("Partial credit must be less than total");
      }

      if (!credit && !installment && paid_amount !== total_amount) {
        throw new Error(
          `Payment mismatch (Expected ${total_amount}, Paid ${paid_amount})`
        );
      }

    
      const order = await Order.create(
        {
          customer_id: customerId,
          subtotal,
          tax_total,
          discount_total,
          coupon_total,
          total_amount,
          status: installment ? "pending" : "completed",
          purchase_type: "in_store",
          admin_id,
          note,
        },
        { transaction: t }
      );

   
      for (const item of items) {
        const total_price =
          item.total_price || item.unit_price * item.quantity;

        await OrderItem.create(
          {
            order_id: order.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: round(item.unit_price),
            total_price: round(total_price),
          },
          { transaction: t }
        );
      }

     
      for (const pay of payments) {
        await OrderPayment.create(
          {
            order_id: order.id,
            method: pay.method,
            amount: round(pay.amount),
            reference: pay.reference || null,
          },
          { transaction: t }
        );
      }

    
      if (credit) {
        await CreditAccount.create(
          {
            order_id: order.id,
            customer_id: customerId,
            total_amount,
            amount_paid: paid_amount,
            balance: round(total_amount - paid_amount),
            credit_type: credit.creditType || credit.type,
            issued_at: new Date(),
          },
          { transaction: t }
        );
      }

   
      if (!installment) {
        for (const item of items) {
          const variant = await Variant.findByPk(item.variant_id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (!variant) throw new Error("Variant not found");
          if (variant.quantity < item.quantity)
            throw new Error("Insufficient stock");

          await InventoryLog.create(
            {
              variant_id: item.variant_id,
              quantity: -item.quantity,
              type: "sale",
              note: credit
                ? `CREDIT_ORDER_${order.id}`
                : `CASH_ORDER_${order.id}`,
              recorded_by: admin_id,
              recorded_by_type: "admin",
              reason: "decrease",
            },
            { transaction: t }
          );

          await variant.decrement("quantity", {
            by: item.quantity,
            transaction: t,
          });
        }
      }

    
      if (installment) {
        const down = round(
          installment.downPayment || installment.down_payment
        );
        const count =
          installment.numberOfPayments || installment.number_of_payments;

        if (count <= 1) throw new Error("Invalid installment count");

        const remaining = round(total_amount - down);
        const per = round(remaining / (count - 1));

        const plan = await InstallmentPlan.create(
          {
            order_id: order.id,
            customer_id: customerId,
            total_amount,
            down_payment: down,
            remaining_balance: remaining,
            number_of_payments: count,
            payment_frequency:
              installment.paymentFrequency || installment.payment_frequency,
            start_date:
              installment.startDate || installment.start_date,
            notes: installment.notes,
          },
          { transaction: t }
        );

        await InstallmentPayment.create(
          {
            installment_plan_id: plan.id,
            payment_number: 0,
            amount: down,
            paid_at: new Date(),
            status: "paid",
            method: payments[0]?.method || "cash",
            type: "down_payment",
          },
          { transaction: t }
        );

        let allocated = 0;
        for (let i = 1; i < count; i++) {
          const due = new Date(
            installment.startDate || installment.start_date
          );
          due.setMonth(due.getMonth() + i);

          const amount =
            i === count - 1 ? round(remaining - allocated) : per;

          allocated += amount;

          await InstallmentPayment.create(
            {
              installment_plan_id: plan.id,
              payment_number: i,
              amount,
              due_date: due,
              type: "installment",
            },
            { transaction: t }
          );
        }
      }

      return order;
    });


    const sale = await Order.findByPk(order.id, {
  include: [
    {
      model: Customer,
    },
    {
      model: OrderItem,
      include: [
        {
          model: Variant,
          as: "variant",
        },
      ],
    },
    {
      model: OrderPayment,
    },
    {
      model: CreditAccount,
      as: "credit_account",  
    },
    {
      model: InstallmentPlan,
      as: "installment_plan", 
      include: [
        {
          model: InstallmentPayment,
          as: "InstallmentPayments",
        },
      ],
    },
  ],
});


    return res.status(201).json(sale);

  } catch (err) {
    console.error("❌ createSale error:", err);
    return res.status(400).json({ message: err.message });
  }
};

//   exports.createSale = async (req, res) => {
//   const t = await sequelize.transaction();

 
//   const round = (n) => Number(Number(n).toFixed(2));

//   try {
//     const {
//       customer_id,
//       customer,
//       items,
//       payments = [],
//       credit,
//       installment,
//       discount = 0,
//       coupon = 0,
//       taxes = 0,
//       note,
//     } = req.body;

//     const admin_id = req.user.admin_id;

//     if (!items || !Array.isArray(items) || items.length === 0) {
//       throw new Error("Sale must contain at least one item");
//     }

   
//     let customerId = customer_id || null;

//     if (!customerId && !customer) {
//       // No customer ID and no customer data - need a walk-in customer
//       let walkIn = await Customer.findOne({
//         where: {
//           [Op.or]: [
//             { is_walk_in: true },
//             { name: "Walk-in" }
//           ]
//         },
//         transaction: t,
//       });

//       if (!walkIn) {
//         walkIn = await Customer.create(
//           { name: "Walk-in", is_walk_in: true },
//           { transaction: t }
//         );
//       }

//       customerId = walkIn.id;
//     } else if (!customerId && customer) {
//       // Customer object provided without ID
//       // If it's a walk-in, use existing one instead of creating duplicate
//       if (customer.is_walk_in === true || customer.name?.toLowerCase() === 'walk-in') {
//         // It's a walk-in customer - check for existing one
//         let existingWalkIn = await Customer.findOne({
//           where: {
//             [Op.or]: [
//               { is_walk_in: true },
//               { name: "Walk-in" }
//             ]
//           },
//           transaction: t,
//         });

//         if (existingWalkIn) {
//           customerId = existingWalkIn.id;
//         } else {
//           // Create new walk-in
//           const newWalkIn = await Customer.create(
//             { name: "Walk-in", is_walk_in: true },
//             { transaction: t }
//           );
//           customerId = newWalkIn.id;
//         }
//       } else {
//         // Regular customer - create normally
//         const created = await Customer.create(customer, { transaction: t });
//         customerId = created.id;
//       }
//     }

  
//     let subtotal = 0;
//     let tax_total = Number(taxes);
//     let discount_total = Number(discount);
//     let coupon_total = Number(coupon);

//     for (const item of items) {
//       // Calculate item total from unit_price * quantity if total_price not provided
//       const itemTotal = Number(item.total_price || (item.unit_price * item.quantity) || 0);
//       subtotal += itemTotal;

//       if (Array.isArray(item.taxes)) {
//         tax_total += item.taxes.reduce((s, t) => s + Number(t.amount || 0), 0);
//       }
//       if (Array.isArray(item.discounts)) {
//         discount_total += item.discounts.reduce(
//           (s, d) => s + Number(d.amount || 0),
//           0
//         );
//       }
//       if (Array.isArray(item.coupons)) {
//         coupon_total += item.coupons.reduce(
//           (s, c) => s + Number(c.amount || 0),
//           0
//         );
//       }
//     }

//     subtotal = round(subtotal);
//     // Use sent tax value if provided, otherwise calculate from items
//     tax_total = round(tax_total > 0 ? tax_total : (Number(taxes) || 0));
//     discount_total = round(discount_total > 0 ? discount_total : (Number(discount) || 0));
//     coupon_total = round(coupon_total);

//     const total_amount = round(
//       subtotal + tax_total - discount_total - coupon_total
//     );

//     const paid_amount = round(
//       payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
//     );

    
//     if (installment) {
//       const downPaymentAmount = installment.downPayment || installment.down_payment;
//       if (paid_amount !== round(downPaymentAmount)) {
//         throw new Error("Down payment mismatch");
//       }
//     }

//     if (credit) {
//       const creditType = credit.creditType || credit.type;
//       if (creditType === "full" && paid_amount > 0) {
//         throw new Error("Full credit cannot have upfront payment");
//       }
//       if (creditType === "partial" && paid_amount >= total_amount) {
//         throw new Error("Partial credit must be less than total");
//       }
//     }

//     if (!credit && !installment && paid_amount !== total_amount) {
//       console.error(`Payment validation failed:
//         Subtotal: ${subtotal}
//         Tax: ${tax_total}
//         Discount: ${discount_total}
//         Total Expected: ${total_amount}
//         Total Paid: ${paid_amount}
//         Payment Methods: ${JSON.stringify(payments)}
//       `);
//       throw new Error(`Payment total must equal order total (Expected: ${total_amount}, Paid: ${paid_amount})`);
//     }

   
//     const order = await Order.create(
//       {
//         customer_id: customerId,
//         subtotal,
//         tax_total,
//         discount_total,
//         coupon_total,
//         total_amount,
//         status: installment ? "pending" : "completed",
//         purchase_type: "in_store",
//         admin_id,
//         note,
//       },
//       { transaction: t }
//     );

   
//     for (const item of items) {
//       // Calculate total_price from unit_price * quantity if not provided
//       const itemTotalPrice = item.total_price || (item.unit_price * item.quantity);
//       await OrderItem.create(
//         {
//           order_id: order.id,
//           product_id: item.product_id,
//           variant_id: item.variant_id,
//           quantity: item.quantity,
//           unit_price: round(item.unit_price),
//           total_price: round(itemTotalPrice),
//         },
//         { transaction: t }
//       );
//     }

   
//     for (const pay of payments) {
//       await OrderPayment.create(
//         {
//           order_id: order.id,
//           method: pay.method,
//           amount: round(pay.amount),
//           reference: pay.reference || null,
//         },
//         { transaction: t }
//       );
//     }

    
//     if (credit) {
//       await CreditAccount.create(
//         {
//           order_id: order.id,
//           customer_id: customerId,
//           total_amount,
//           amount_paid: paid_amount,
//           balance: round(total_amount - paid_amount),
//           credit_type: credit.creditType || credit.type,
//           issued_at: new Date(),
//         },
//         { transaction: t }
//       );
//     }

  
//     if (!installment) {
//       for (const item of items) {
//         const variant = await Variant.findByPk(item.variant_id, {
//           transaction: t,
//           lock: t.LOCK.UPDATE,
//         });

//         if (!variant) throw new Error("Variant not found");

//         if (variant.quantity < item.quantity) {
//           throw new Error(
//             `Insufficient stock for variant ${variant.id}. Available: ${variant.quantity}`
//           );
//         }


//         const qtyChange = -Math.abs(item.quantity);

//         await InventoryLog.create(
//           {
//             variant_id: item.variant_id,
//            quantity: qtyChange,
//             type: "sale",
//             note: credit
//               ? `CREDIT_ORDER_${order.id}`
//               : `CASH_ORDER_${order.id}`,
//             recorded_by: admin_id,
//             recorded_by_type: 'admin',
//             reason: 'decrease',
//           },
//           { transaction: t }
//         );

//         await variant.decrement("quantity", {
//           by: item.quantity,
//           transaction: t,
//         });
//       }
//     }

    
//    if (installment) {
//   const downPayment =
//     round(installment.downPayment || installment.down_payment);

//   const totalPayments =
//     installment.numberOfPayments || installment.number_of_payments;

//   if (totalPayments <= 1) {
//     throw new Error("Number of payments must be greater than 1");
//   }

  
//   const installmentCount = totalPayments - 1;

//   const remainingBalance = round(total_amount - downPayment);

//   const perPayment = round(remainingBalance / installmentCount);

 
//   const plan = await InstallmentPlan.create(
//     {
//       order_id: order.id,
//       customer_id: customerId,
//       total_amount,
//       down_payment: downPayment,
//       remaining_balance: remainingBalance,
//       number_of_payments: totalPayments, 
//       payment_frequency:
//         installment.paymentFrequency || installment.payment_frequency,
//       start_date: installment.startDate || installment.start_date,
//       notes: installment.notes,
//     },
//     { transaction: t }
//   );

  
//   await InstallmentPayment.create(
//     {
//       installment_plan_id: plan.id,
//       payment_number: 0, 
//       amount: downPayment,
//       paid_at: new Date(),
//       status: "paid",
//       method: payments[0]?.method || "cash",
//       type: "down_payment",
//     },
//     { transaction: t }
//   );

//   let allocated = 0;

//   for (let i = 1; i <= installmentCount; i++) {
//     const due = new Date(installment.startDate || installment.start_date);
//   due.setMonth(due.getMonth() + i);

//   const amount =
//     i === installmentCount
//       ? round(remainingBalance - allocated)
//       : perPayment;

//   allocated += amount;

//   await InstallmentPayment.create(
//     {
//       installment_plan_id: plan.id,
//       payment_number: i,
//       amount,
//       due_date: due,
//       type: "installment",
//     },
//     { transaction: t }
//   );
//   }
// }



//     const sale = await Order.findByPk(order.id, {
//       include: [
//         Customer,
//         OrderItem,
//         OrderPayment,
//         CreditAccount,
//         InstallmentPlan,
//       ],
//     });

//     return res.status(201).json(sale);
    
//     await t.commit();
//   } catch (err) {
//     await t.rollback();
//     console.error("❌ createSale error:", err);
//     return res.status(400).json({ message: err.message });
//   }
// };


exports.payInstallment = async (req, res) => {
  const t = await sequelize.transaction();

  try {
   
    if (!req.user || !req.user.admin_id) {
      throw new Error("Only admins can record installment payments");
    }

    const { installment_payment_id, amount, method, reference } = req.body;

    const installment = await InstallmentPayment.findByPk(
      installment_payment_id,
      { transaction: t }
    );

    if (!installment) {
      throw new Error("Installment payment not found");
    }

    if (installment.status === "paid") {
      throw new Error("Installment already paid");
    }

    if (Number(amount) !== Number(installment.amount)) {
      throw new Error("Installment amount mismatch");
    }

  
    await installment.update(
      {
        status: "paid",
        paid_at: new Date(),
        method: method,
      },
      { transaction: t }
    );

    const plan = await InstallmentPlan.findByPk(
      installment.installment_plan_id,
      { transaction: t }
    );

    const newBalance = Number(plan.remaining_balance) - Number(amount);

      if (newBalance < -0.01) {
        throw new Error("Installment overpayment detected");
      }

    await plan.update(
      {
        remaining_balance: newBalance,
        status: newBalance <= 0 ? "completed" : "active",
      },
      { transaction: t }
    );

   
    await OrderPayment.create(
      {
        order_id: plan.order_id,
        method,
        amount,
        reference,
        status: "paid",
        meta: {
          installment_payment_id: installment.id,
          recorded_by: req.user.admin_id,
        },
      },
      { transaction: t }
    );

    
    if (newBalance <= 0) {
      const order = await Order.findByPk(plan.order_id, {
        include: [OrderItem],
        transaction: t,
      });

      
      if(order.status !== "completed"){
        await order.update(
        { status: "completed" },
        { transaction: t }
      );


      for (const item of order.OrderItems) {
        await InventoryLog.create(
          {
            variant_id: item.variant_id,
            quantity: -item.quantity,
            type: "sale",
            note: `INSTALLMENT_COMPLETED_ORDER_${order.id}`,
            recorded_by: req.user.admin_id,
            recorded_by_type: 'admin',
            reason: 'decrease',
          },
          { transaction: t }
        );

        await Variant.decrement(
          { quantity: item.quantity },
          { where: { id: item.variant_id }, transaction: t }
        );
      }
      }
    }

    await t.commit();

    return res.json({
      message: "Installment payment successful",
      balance: newBalance,
      completed: newBalance <= 0,
    });

  } catch (err) {
    await t.rollback();
    console.error("❌ payInstallment error:", err);
    return res.status(400).json({ message: err.message });
  }
};


exports.getSales = async (req, res) => {
  try {
    const { filter = 'today', page = 1, limit = 10, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    const where = { admin_id: req.user.admin_id };

   
    const { start, end } = getDateRange(filter, start_date, end_date);
    where.createdAt = { [Op.between]: [start, end] };

    const { rows, count } = await Order.findAndCountAll({
      where,
      include: [
        Customer,
        OrderItem,
        OrderPayment,
        {model: CreditAccount, as: 'credit_account'},
        {model: InstallmentPlan, as: 'installment_plan'},
      ],
      limit: parseInt(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      total: count,
      page: Number(page),
      totalPages: Math.ceil(count / limit),
      sales: rows,
    });

  } catch (err) {
    console.error("❌ getSales error:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Order.findOne({
      where: {
        id,
        admin_id: req.user.admin_id
      },
      include: [
        Customer,
        OrderItem,
        OrderPayment,
        CreditAccount,
        {
          model: InstallmentPlan,
          include: [InstallmentPayment],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    return res.json(sale);

  } catch (err) {
    console.error("❌ getSaleById error:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllInstallmentPlans = async (req, res) => {
  try {
    const plans = await InstallmentPlan.findAll({
      include: [
        {
          model: Customer,
          required: false
        },
        {
          model: InstallmentPayment,
          order: [["payment_number", "ASC"]],
          separate: true,
          as: 'InstallmentPayments'
        },
        {
          model: Order,
          required: false
        }
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(plans);
  } catch (err) {
    console.error("❌ getAllInstallmentPlans error:", err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getCustomerInstallments = async (req, res) => {
  try {
    const { customerId } = req.params;

    const plans = await InstallmentPlan.findAll({
      where: { customer_id: customerId },
      include: [
        InstallmentPayment,
        Order,
      ],
    });

    return res.json(plans);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


exports.getInstallmentPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await InstallmentPlan.findByPk(id, {
      include: [
          { model: InstallmentPayment, as: 'InstallmentPayments' },
        Customer,
        Order,
      ],
    });

    if (!plan) {
      return res.status(404).json({ message: "Installment plan not found" });
    }

    return res.json(plan);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};


exports.getInstallmentTransaction = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await InstallmentPayment.findByPk(paymentId, {
      include: [
        {
          model: InstallmentPlan,
          include: [
            Customer,
            {
              model: Order,
              include: [OrderPayment]
            }
          ]
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

  
    const orderPayment = await OrderPayment.findOne({
      where: {
        order_id: payment.InstallmentPlan.order_id,
        'meta.installment_payment_id': payment.id
      }
    });

    const transaction = {
      id: `INST-${payment.id}-${Date.now()}`,
      planId: payment.InstallmentPlan.id,
      paymentNumber: payment.payment_number,
      amountPaid: Number(payment.amount),
      paymentMethod: orderPayment?.method || payment.method || 'cash',
      timestamp: payment.paid_at,
      customer: {
        name: payment.InstallmentPlan.Customer?.name || 'Unknown',
        email: payment.InstallmentPlan.Customer?.email,
        phone: payment.InstallmentPlan.Customer?.phone,
      },
      paymentFrequency: payment.InstallmentPlan.payment_frequency,
      numberOfPayments: payment.InstallmentPlan.number_of_payments,
      amountPerPayment: Number(payment.InstallmentPlan.amount_per_payment),
      downPayment: Number(payment.InstallmentPlan.down_payment),
      remainingBalanceAfter: Number(payment.InstallmentPlan.remaining_balance),
    };

    return res.json(transaction);
  } catch (err) {
    console.error("❌ getInstallmentTransaction error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// const isBooleanString = v => ['true','false', true, false].includes(v);

// const isValidDate = (s) => validator.isDate(String(s || ''), { format: 'YYYY-MM-DD', strictMode: true });


// const daysBetween = (start, end) => {
//   const a = new Date(start);
//   const b = new Date(end);
//   return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
// };



exports.salesReport = async (req, res) => {
  try {
    const validation = validateSalesReportQuery(req.query);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await buildSalesReport(req.query, req.user);

    if (result.queued) {
      return res.status(202).json({
        message: "Large report queued",
        report_id: result.report_id
      });
    }

    return res.json(result);
  } catch (err) {
    console.error("❌ Sales report failed:", err);
    res.status(500).json({
      error: "Failed to generate sales report",
      details: err.message
    });
  }
};

exports.reportStatus = async (req, res) => {
  const { reportId } = req.params;

  try {
    const report = await Report.findByPk(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const response = {
      report_id: report.id,
      status: report.status,
      format: report.format,
      created_at: report.createdAt,
      processing_started_at: report.processing_started_at,
      processing_completed_at: report.processing_completed_at,
    };

    if (report.status === 'completed') {
      response.download_url = `/api/sales/reports/download/${report.id}`;
    }

    if (report.status === 'failed') {
      response.error = report.error;
    }

    res.json(response);
  } catch (err) {
    console.error('❌ Report status error:', err);
    res.status(500).json({ error: 'Failed to fetch report status' });
  }
};

exports.downloadReport = async (req, res) => {
  const { reportId } = req.params;

  try {
    const report = await Report.findByPk(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({ error: 'Report not ready for download', status: report.status });
    }

    if (!report.result_path || report.result_path.trim() === '') {
      return res.status(500).json({ error: 'No file path stored for this report' });
    }

    const filePath = path.resolve(report.result_path);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({ error: 'Report file not found on server' });
    }

    const fileName = `sales-report-${report.id}.${report.format}`;
    res.download(filePath, fileName);
  } catch (err) {
    console.error('❌ Report download error:', err);
    res.status(500).json({ error: 'Failed to download report' });
  }
};
