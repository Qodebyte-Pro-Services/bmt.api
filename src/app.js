const dotenv = require('dotenv');

const express = require('express'); 

const sequelize = require('./config/db');

const cors = require('cors');

const helmet = require('helmet');

const routes = require('./routes');

const path = require('path');

const setupSwagger = require('../swagger');
const morgan = require('morgan');
const startReportCron = require("./cron/report");
const startStockNotificationCron = require('./cron/startStockNotificationCron');


dotenv.config();

const app = express();




app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev'));
setupSwagger(app);


app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('Welcome to the API For Qodebyte!');
});

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const PORT = process.env.PORT || 5002;

if (process.env.NODE_ENV === 'production') {
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Database connected');
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);

        startReportCron();
        if (process.env.INSTANCE_ID === '0') {
          startStockNotificationCron();
        }
        console.log('🔄 Stock Notification Worker started');
      });
    })
    .catch((err) => {
      console.error('❌ Unable to connect to the database:', err);
    });
} else {

  sequelize.sync({ alter: true })
    .then(() => {
      console.log('✅ Database synced');
      return sequelize.authenticate();
    })
    .then(() => {
      console.log('✅ Database connected');
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);

        startReportCron();
        if (process.env.INSTANCE_ID === '0') {
          startStockNotificationCron();
        }
       console.log('🔔 Stock Notification Cron active');

      });
    })
    .catch((err) => {
      console.error('❌ Unable to connect to the database:', err);
    });
}


module.exports = app;