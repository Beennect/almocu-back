"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const router = (0, express_1.Router)();
/**
 * @openapi
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       required:
 *         - productName
 *         - quantity
 *         - price
 *       properties:
 *         productName:
 *           type: string
 *           example: X-Burguer
 *         quantity:
 *           type: integer
 *           example: 2
 *         price:
 *           type: number
 *           example: 25.90
 *         observations:
 *           type: string
 *           example: Sem cebola
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 664f1a2b3c4d5e6f7a8b9c0d
 *         restaurantId:
 *           type: string
 *           example: 664f1a2b3c4d5e6f7a8b9c01
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         totalValue:
 *           type: number
 *           example: 51.80
 *         status:
 *           type: string
 *           enum: [pendente, em_preparo, pronto, entregue, cancelado]
 *           example: pendente
 *         orderDate:
 *           type: string
 *           format: date-time
 *         origin:
 *           type: string
 *           example: balcão
 *         observations:
 *           type: string
 *           example: Mesa 5
 */
/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Criar um novo pedido
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - items
 *             properties:
 *               restaurantId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItem'
 *               origin:
 *                 type: string
 *               observations:
 *                 type: string
 *     responses:
 *       201:
 *         description: Pedido criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Dados obrigatórios ausentes
 *       500:
 *         description: Erro interno
 */
router.post('/', controller_1.createOrder);
/**
 * @openapi
 * /orders:
 *   get:
 *     summary: Listar todos os pedidos (filtrável por restaurante)
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         description: Filtra pedidos por restaurante
 *     responses:
 *       200:
 *         description: Lista de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       500:
 *         description: Erro interno
 */
router.get('/', controller_1.getAllOrders);
/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Buscar pedido por ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         description: Pedido não encontrado
 *       500:
 *         description: Erro interno
 */
router.get('/:id', controller_1.getOrderById);
/**
 * @openapi
 * /orders/{id}:
 *   patch:
 *     summary: Atualizar status ou observações do pedido
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pendente, em_preparo, pronto, entregue, cancelado]
 *               observations:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pedido atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         description: Pedido não encontrado
 *       500:
 *         description: Erro interno
 */
router.patch('/:id', controller_1.updateOrder);
/**
 * @openapi
 * /orders/{id}:
 *   delete:
 *     summary: Deletar um pedido
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido deletado com sucesso
 *       404:
 *         description: Pedido não encontrado
 *       500:
 *         description: Erro interno
 */
router.delete('/:id', controller_1.deleteOrder);
exports.default = router;
