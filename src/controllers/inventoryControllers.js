const { Variant, InventoryLog } = require('../models/product');
const StockNotificationService = require('../services/stockNotifications');
const { Admin } = require('../models');
const stockNotificationQueue = require('../jobs/stockNotificationQueue');


exports.adjustStock = async (req, res) => {
  const t = await Variant.sequelize.transaction();
  const affectedVariants = [];

  try {
    const { adjustments } = req.body;

    const recorded_by = req.user.admin_id;
    const recorded_by_type = 'admin';

    let adjList = [];
    if (Array.isArray(adjustments)) {
      adjList = adjustments;
    } else if (req.body.variant_id && typeof req.body.new_quantity === 'number') {
      adjList = [{
        variant_id: req.body.variant_id,
        new_quantity: req.body.new_quantity,
        reason: req.body.reason,
        notes: req.body.notes
      }];
    } else {
      return res.status(400).json({ message: 'adjustments array or variant_id/new_quantity required.' });
    }

    const results = [];

    for (const adj of adjList) {
      const { variant_id, new_quantity, reason, notes } = adj;

      if (!variant_id || typeof new_quantity !== 'number' || !reason) {
        results.push({ variant_id, error: 'variant_id, new_quantity, and reason are required.' });
        continue;
      }

      const variant = await Variant.findByPk(variant_id, { transaction: t });
      if (!variant) {
        results.push({ variant_id, error: 'Variant not found.' });
        continue;
      }

      const old_quantity = variant.quantity;
      const quantity_change = new_quantity - old_quantity;

 
      await variant.update({ quantity: new_quantity }, { transaction: t });


      await InventoryLog.create({
        variant_id,
        type: 'adjustment',
        quantity: quantity_change,
        reason,
        note: notes || null,
        recorded_by,
        recorded_by_type
      }, { transaction: t });

      affectedVariants.push(variant_id);

      results.push({
        variant_id,
        message: 'Stock adjusted',
        old_quantity,
        new_quantity,
        quantity_change
      });
    }

    await t.commit();

   
 for (const variant_id of affectedVariants) {
  try {
    await StockNotificationService.processVariant(variant_id);
  } catch (err) {
    console.error(`❌ Notification failed for variant ${variant_id}`, err);
  }
}
  
    return res.status(200).json({ results });
   
  } catch (err) {
    await t.rollback();
    console.error(err);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};


exports.getStockMovements = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    const { count, rows } = await InventoryLog.findAndCountAll({
      include: [
        {
          model: Variant,
          as: 'variant',
          attributes: ['sku', 'product_id'],
        },
        {
          model: Admin,
          as: 'recorded_by_admin',
          attributes: ['admin_id', 'email', 'full_name'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    const formattedLogs = rows.map(log => {
      let recorded_by_name = 'Unknown';
      
      if (log.recorded_by_type === 'admin' && log.recorded_by_admin) {
        recorded_by_name = log.recorded_by_admin.full_name || log.recorded_by_admin.email;
      }

      return {
        ...log.get({ plain: true }),
        recorded_by_name,
      };
    });

    return res.status(200).json({
      logs: formattedLogs,
      totalPages: Math.ceil(count / limit),
      totalCount: count,
      page,
      limit,
    });

  } catch (err) {
    console.error('Error fetching stock movements:', err);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

exports.getProductStockMovements = async (req, res) => {
  try {
    const { product_id } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    if (!product_id) {
      return res.status(400).json({ message: 'product_id is required.' });
    }

    const { count, rows } = await InventoryLog.findAndCountAll({
      include: [
        {
          model: Variant,
          as: 'variant',
          where: { product_id },
          attributes: ['id', 'sku', 'product_id'],
        },
        {
          model: Admin,
          as: 'recorded_by_admin',
          attributes: ['admin_id', 'email', 'full_name'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    const formattedLogs = rows.map((log) => {
        let recorded_by_name = 'Unknown';
      
      if (log.recorded_by_type === 'admin' && log.recorded_by_admin) {
        recorded_by_name = log.recorded_by_admin.full_name || log.recorded_by_admin.email;
      }

      return {
        ...log.get({ plain: true }),
        recorded_by_name,
      };
    });
    
    return res.status(200).json({
      logs: formattedLogs,
      totalPages: Math.ceil(count / limit),
      totalCount: count,
      page,
      limit,
    });
  } catch (err) {
    console.error('Error fetching product stock movements:', err);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};
