const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const doc = {
  info: {
    title: 'Stock API',
    description: 'API de Gerenciamento de Estoque - Gerada automaticamente',
  },
  host: 'localhost:3100',
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
const endpointsFiles = ['./index.ts'];

swaggerAutogen(outputFile, endpointsFiles, doc);
