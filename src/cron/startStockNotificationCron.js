const StockNotificationService = require('../services/stockNotifications');
const { Variant } = require('../models');

async function checkAllStockLevels() {
  try {
    console.log('📊 Checking stock levels...');

    const variants = await Variant.findAll({
      attributes: ['id']
    });

    if (!variants.length) {
      console.log('ℹ️ No variants found');
      return;
    }

    for (const variant of variants) {
      try {
        await StockNotificationService.processVariant(variant.id);
      } catch (err) {
        console.error(
          `❌ Failed processing variant ${variant.id}:`,
          err.message
        );
      }
    }

    console.log(`✅ Checked ${variants.length} variants`);
  } catch (error) {
    console.error('❌ Error checking stock levels:', error);
  }
}

function startStockNotificationCron() {
  try {
    console.log('🔔 Stock Notification Cron Starting...');

   
    checkAllStockLevels();

  
    const intervalId = setInterval(
      checkAllStockLevels,
      10 * 60 * 1000
    );

    console.log('✅ Stock Notification Cron Started (every 10 minutes)');

    return intervalId;
  } catch (error) {
    console.error('❌ Failed to start Stock Notification Cron:', error);
  }
}

module.exports = startStockNotificationCron;
