const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');




const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Qodebyte Academy API',
      version: '1.0.0',
      description: 'API documentation for Qodebyte Academy',
    },
    servers: [
      { url: 'https://academy.qodebyte.com/api' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
         OTP: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entity_id: { type: 'string', format: 'uuid' },
            entity_type: { type: 'string', enum: ['Admin', 'User', 'Vendor'] },
            otp: { type: 'string' },
            purpose: { type: 'string' },
            expires_at: { type: 'string', format: 'date-time' },
            attempts: { type: 'integer' }
          }
        },
    },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;
