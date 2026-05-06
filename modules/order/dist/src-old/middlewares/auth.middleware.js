"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: 'Token não fornecido' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const restaurantId = req.headers['x-tenant-id'] || req.headers['x-restaurant-id'] || decoded.restaurantId;
            const role = req.headers['x-user-role'] || decoded.role;
            req.user = {
                ...decoded,
                restaurantId,
                role
            };
            if (roles.length > 0) {
                const activeRole = req.user.role;
                const globalRoles = decoded.globalRoles || [];
                const hasRole = roles.includes(activeRole) || roles.some(r => globalRoles.includes(r));
                if (!hasRole) {
                    return res.status(403).json({ message: 'Acesso negado: cargo insuficiente' });
                }
            }
            next();
        }
        catch (err) {
            return res.status(401).json({ message: 'Token inválido ou expirado' });
        }
    };
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map