// const { Worker } = require('bullmq');
// const Redis = require('ioredis');
// const StockNotificationService = require('../services/stockNotifications');

// const redisConnection = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   maxRetriesPerRequest: null,
// });

// const stockNotificationWorker = new Worker(
//   'stock-notifications',
//   async (job) => {
//     const { variant_id } = job.data;
//     await StockNotificationService.processVariant(variant_id);
//   },
//   {
//     connection: redisConnection,
//     concurrency: 5
//   }
// );

// stockNotificationWorker.on('failed', (job, err) => {
//   console.error(`❌ Job ${job.id} failed:`, err.message);
// });

// stockNotificationWorker.on('completed', (job) => {
//   console.log(`✅ Job ${job.id} completed`);
// });

// module.exports = stockNotificationWorker;
