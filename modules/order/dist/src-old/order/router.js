"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use((0, auth_middleware_1.authMiddleware)());
router.get('/user/all', controller_1.getAllUserOrders);
router.get('/', controller_1.getAllOrders);
router.get('/:id', controller_1.getOrderById);
router.post('/', controller_1.createOrder);
router.patch('/:id', controller_1.updateOrder);
router.delete('/:id', (0, auth_middleware_1.authMiddleware)(['admin']), controller_1.deleteOrder);
exports.default = router;
//# sourceMappingURL=router.js.map