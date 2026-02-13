// const { Queue } = require('bullmq');
// const Redis = require('ioredis');

// const redisConnection = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: process.env.REDIS_PORT || 6379,
//   maxRetriesPerRequest: null,
// });

// const stockNotificationQueue = new Queue('stock-notifications', {
//   connection: redisConnection,
//   defaultJobOptions: {
//     attempts: 3,
//     backoff: {
//       type: 'exponential',
//       delay: 2000,
//     },
//     removeOnComplete: true,
//     removeOnFail: false,
//   },
// });

// module.exports = stockNotificationQueue;
