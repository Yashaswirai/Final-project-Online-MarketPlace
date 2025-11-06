const jwt = require('jsonwebtoken');

const authMiddleware = (socket, next) => {
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) {
        return next(new Error('No cookies found'));
    }
    const token = cookies.split('=')[1].split(';')[0];
    if (!token) {
        return next(new Error('Authentication token is missing'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        socket.token = token;
        return next();
    } catch (error) {
        return next(new Error('Invalid authentication token'));
    }
}

module.exports = authMiddleware;