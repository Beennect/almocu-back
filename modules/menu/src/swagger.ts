import swaggerJsDoc from 'swagger-jsdoc';

const ProductSchema = {
    type: 'object',
    required: ['name', 'brand', 'price', 'restaurantId'],
    properties: {
        _id:           { type: 'string', description: 'ID interno (MongoDB ObjectId)' },
        name:          { type: 'string', example: 'Filé de Frango' },
        brand:         { type: 'string', example: 'Sadia' },
        price:         { type: 'number', example: 29.90 },
        description:   { type: 'string', example: 'Filé de frango temperado 1kg' },
        restaurantId:  { type: 'string', example: 'rest_001' },
        createdAt:     { type: 'string', format: 'date-time' },
        updatedAt:     { type: 'string', format: 'date-time' },
    },
};

const restaurantIdQuery = {
    in: 'query', name: 'restaurantId', required: true, schema: { type: 'string' },
    description: 'ID do restaurante',
};

const idParam = {
    in: 'path', name: 'id', required: true, schema: { type: 'string' },
    description: 'ID do produto',
};

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Menu API',
            version: '1.0.0',
            description: 'API para gerenciamento de produtos do cardápio',
        },
        servers: [{ url: 'http://localhost:3000' }],
        components: {
            schemas: { Product: ProductSchema },
        },
        paths: {
            '/product/{id}': {
                get: {
                    summary: 'Obter um produto',
                    tags: ['Produto'],
                    parameters: [idParam, restaurantIdQuery],
                    responses: {
                        200: { description: 'Produto encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
                        404: { description: 'Produto não encontrado' },
                    },
                },
                delete: {
                    summary: 'Deletar um produto',
                    tags: ['Produto'],
                    parameters: [idParam, restaurantIdQuery],
                    responses: {
                        200: { description: 'Produto deletado' },
                        404: { description: 'Produto não encontrado' },
                    },
                },
                patch: {
                    summary: 'Atualizar um produto',
                    tags: ['Produto'],
                    parameters: [idParam],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['restaurantId'],
                                    properties: {
                                        restaurantId:  { type: 'string' },
                                        name:          { type: 'string' },
                                        brand:         { type: 'string' },
                                        price:         { type: 'number' },
                                        description:   { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Produto atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
                        409: { description: 'Produto duplicado' },
                    },
                },
            },
            '/product': {
                post: {
                    summary: 'Criar um produto',
                    tags: ['Produto'],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } },
                    },
                    responses: {
                        201: { description: 'Produto criado' },
                        409: { description: 'Produto duplicado (mesmo nome + marca + restaurante)' },
                    },
                },
            },
            '/products': {
                get: {
                    summary: 'Listar produtos de um restaurante',
                    tags: ['Produtos (batch)'],
                    parameters: [restaurantIdQuery],
                    responses: {
                        200: {
                            description: 'Lista de produtos',
                            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } },
                        },
                    },
                },
                post: {
                    summary: 'Criar múltiplos produtos',
                    tags: ['Produtos (batch)'],
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } },
                    },
                    responses: {
                        201: { description: 'Produtos criados' },
                        409: { description: 'Um ou mais produtos duplicados' },
                    },
                },
                delete: {
                    summary: 'Deletar múltiplos produtos',
                    tags: ['Produtos (batch)'],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['ids', 'restaurantId'],
                                    properties: {
                                        ids:            { type: 'array', items: { type: 'string' } },
                                        restaurantId:   { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        200: { description: 'Produtos deletados' },
                    },
                },
            },
        },
    },
    apis: [], // Sem JSDoc annotations — tudo definido acima
};

export const swaggerDocs = swaggerJsDoc(swaggerOptions);
