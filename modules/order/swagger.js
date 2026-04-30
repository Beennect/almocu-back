const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
  info: {
    title: 'Order API',
    description: 'API de Gerenciamento de Pedidos - Gerada automaticamente',
  },
  host: 'localhost:3300',
  schemes: ['http'],
  securityDefinitions: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
  },
  security: [{ bearerAuth: [] }],
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./src/index.ts'];

swaggerAutogen(outputFile, endpointsFiles, doc);
