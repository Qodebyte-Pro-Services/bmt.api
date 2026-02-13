const { INVENTORY_MGT_PERMISSIONS } = require('../constants/permissions');
const { Variant, Product, StockNotification, Admin, Role, sequelize } = require('../models');
const { sendNotificationEmail } = require('./emailServices');
const { Op } = require('sequelize');

let ADMIN_CACHE = null;
let ADMIN_CACHE_TS = 0;
const ADMIN_CACHE_TTL = 5 * 60 * 1000;


async function getAdminEmail() {
 
  if (ADMIN_CACHE && Date.now() - ADMIN_CACHE_TS < ADMIN_CACHE_TTL) {
    return ADMIN_CACHE;
  }

  try {
    const admins = await Admin.findAll({
      attributes: ['email', 'admin_id'],
      include: [
        {
          model: Role,
          attributes: ['role_name', 'permissions'],
          required: true
        }
      ],
      raw: false
    });

    if (admins.length === 0) {
      console.warn('⚠️ No admins found with roles');
      ADMIN_CACHE = [];
      ADMIN_CACHE_TS = Date.now();
      return ADMIN_CACHE;
    }

    const inventoryPermissions = Object.values(INVENTORY_MGT_PERMISSIONS);

    const filteredAdmins = admins.filter(admin => {
      if (!admin.Role) return false;

     
      if (admin.Role.role_name === 'Super Admin') return true;

      let permissions = [];

      if (Array.isArray(admin.Role.permissions)) {
        permissions = admin.Role.permissions;
      } else if (typeof admin.Role.permissions === 'string') {
        try {
          permissions = JSON.parse(admin.Role.permissions);
        } catch {
          permissions = admin.Role.permissions.split(',').map(p => p.trim());
        }
      }

      return inventoryPermissions.some(perm =>
        permissions.includes(perm)
      );
    });

   
    ADMIN_CACHE = filteredAdmins.map(user => user.email);
    ADMIN_CACHE_TS = Date.now();

    return ADMIN_CACHE;
  } catch (error) {
    console.error('❌ Error getting admin emails:', error);
    return [];
  }
}


class StockNotificationService {
 
   static async createOnce(variant, type, message, emailFn) {
    const exists = await StockNotification.findOne({
      where: {
        variant_id: variant.id,
        notification_type: type,
        is_read: false
      }
    });

    if (exists) return;

    await StockNotification.create({
      variant_id: variant.id,
      notification_type: type,
      message
    });

    await emailFn.call(this, variant);
  }

  static async resolveIfHealthy(variant) {
    const threshold = variant.threshold || 10;

    if (variant.quantity <= threshold) return;

    const [resolved] = await StockNotification.update(
      { is_read: true, read_at: new Date() },
      {
        where: {
          variant_id: variant.id,
          notification_type: { [Op.in]: ['low_stock', 'out_of_stock'] },
          is_read: false
        }
      }
    );

    if (resolved > 0) {
      await this.createOnce(
        variant,
        'restocked',
        `Restocked: ${variant.product.name} (${variant.sku})`,
        this.sendRestockEmail
      );
    }
  }

  static async processVariant(variant_id) {
    const variant = await Variant.findByPk(variant_id, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variant) return;

    const qty = variant.quantity;
    const threshold = variant.threshold || 10;

    if (qty > threshold) {
      await this.resolveIfHealthy(variant);
      return;
    }

    if (qty === 0) {
      await this.createOnce(
        variant,
        'out_of_stock',
        `Out of stock: ${variant.product.name} (${variant.sku})`,
        this.sendOutOfStockEmail
      );
      return;
    }

    await this.createOnce(
      variant,
      'low_stock',
      `Low stock: ${variant.product.name} (${variant.sku})`,
      this.sendLowStockEmail
    );
  }

  static async markAsRead(notification_id, user_id) {
    try {
      await StockNotification.update(
        { is_read: true, read_at: new Date(), read_by: user_id },
        { where: { id: notification_id } }
      );
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }

  
  static async getUnreadNotifications(limit = 50) {
    try {
      return await StockNotification.findAll({
        where: { is_read: false },
        order: [['created_at', 'DESC']],
        limit,
        include: [
          { model: Variant, as: 'variant', include: [{ model: Product, as: 'product' }] }
        ]
      });
    } catch (error) {
      console.error('❌ Error getting unread notifications:', error);
      return [];
    }
  }


  static async getNotificationStats() {
    try {
      const stats = await StockNotification.findAll({
        attributes: [
          'notification_type',
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_read = false THEN 1 END')), 'unread']
        ],
        group: ['notification_type'],
        raw: true
      });
      return stats;
    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      return [];
    }
  }


static async sendRestockEmail(variant) {
  try {
    const emails = await getAdminEmail();

    if (emails.length === 0) {
      console.warn(`⚠️ No admins found for restock notification: ${variant.sku}`);
      return;
    }

    const subject = `✅ Back in Stock – ${variant.product.name}`;
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2e7d32;">✅ Back in Stock</h2>
        <p><strong>Product:</strong> ${variant.product.name}</p>
        <p><strong>SKU:</strong> ${variant.sku}</p>
        <p><strong>Current Quantity:</strong> ${variant.quantity}</p>
        <p style="color: #2e7d32; font-weight: bold;">
          This item has been successfully restocked and is now available.
        </p>
        <hr>
        <p style="font-size: 12px; color: #999;">
          Automated message from BMT Inventory Management System.
        </p>
      </div>
    `;

    await Promise.all(
      emails.map(email =>
        sendNotificationEmail(email, subject, htmlMessage)
      )
    );

    console.log(`✅ Restock email sent to ${emails.length} admin(s)`);
  } catch (error) {
    console.error('❌ Error sending restock email:', error);
  }
}
 
  static async sendLowStockEmail(variant) {
    try {
      const emails = await getAdminEmail();
      
      if (emails.length === 0) {
        console.warn(`⚠️ No admins with inventory permissions found for low stock notification: ${variant.sku}`);
        return;
      }

      const subject = `⚠️ Low Stock Alert - ${variant.product.name}`;
      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #ff9800;">⚠️ Low Stock Alert</h2>
          <p><strong>Product:</strong> ${variant.product.name}</p>
          <p><strong>SKU:</strong> ${variant.sku}</p>
          <p><strong>Current Quantity:</strong> <span style="color: #ff9800; font-weight: bold;">${variant.quantity}</span></p>
          <p><strong>Threshold:</strong> ${variant.threshold || 10}</p>
          <p style="color: #d32f2f; font-weight: bold;">Please restock soon to avoid stockouts.</p>
          <hr>
          <p style="font-size: 12px; color: #999;">This is an automated notification from BMT Inventory Management System.</p>
        </div>
      `;

     
     await Promise.all(
  emails.map(email =>
    sendNotificationEmail(email, subject, htmlMessage)
  )
);

      console.log(`✅ Low stock notification sent to ${emails.length} admin(s) for ${variant.sku}`);
    } catch (error) {
      console.error('❌ Error sending low stock email:', error);
    }
  }

  static async sendOutOfStockEmail(variant) {
    try {
      const emails = await getAdminEmail();
      
      if (emails.length === 0) {
        console.warn(`⚠️ No admins with inventory permissions found for out of stock notification: ${variant.sku}`);
        return;
      }

      const subject = `🚨 URGENT: Out of Stock - ${variant.product.name}`;
      const htmlMessage = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #d32f2f;">🚨 CRITICAL: Out of Stock</h2>
          <p><strong>Product:</strong> ${variant.product.name}</p>
          <p><strong>SKU:</strong> ${variant.sku}</p>
          <p style="color: #d32f2f; font-weight: bold; font-size: 16px;">This item is now OUT OF STOCK.</p>
          <p style="color: #d32f2f; font-weight: bold;">Immediate action required to restock this item.</p>
          <hr>
          <p style="font-size: 12px; color: #999;">This is an automated notification from BMT Inventory Management System.</p>
        </div>
      `;

     
     await Promise.all(
  emails.map(email =>
    sendNotificationEmail(email, subject, htmlMessage)
  )
);

      console.log(`✅ Out of stock notification sent to ${emails.length} admin(s) for ${variant.sku}`);
    } catch (error) {
      console.error('❌ Error sending out of stock email:', error);
    }
  }

 
 
}

module.exports = StockNotificationService;