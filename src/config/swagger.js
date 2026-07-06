// swagger config, generates api docs from jsdoc comments in the route files
// visit /api-docs once server is running

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Wallet Service API',
      version: '1.0.0',
      description: 'REST API for wallet management and p2p money transfers'
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'local dev server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
