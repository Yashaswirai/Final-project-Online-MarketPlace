const jwt = require('jsonwebtoken');

const createAuthMiddleware = (role = ['user']) => {
    return (req, res, next) => {
        const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Access Denied. No token provided.' });
        }
        try {
            const secret = process.env.JWT_SECRET || 'testsecret';
            const decoded = jwt.verify(token, secret);
            req.user = decoded;
            if (!role.includes(decoded.role)) {
                return res.status(403).json({ message: 'Access Denied. You do not have the required role.' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Invalid token.' });
        }
    }
}

module.exports = {
    createAuthMiddleware
};