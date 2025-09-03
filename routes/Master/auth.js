// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../../Model/MasterSchema/UserSchema');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                message: 'Access token is required',
                errorCode: 'NO_TOKEN'
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, "myservice-secret");
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    message: 'Session expired at 4 PM. Please login again.',
                    errorCode: 'TOKEN_EXPIRED'
                });
            }
            return res.status(403).json({
                message: 'Invalid token',
                errorCode: 'INVALID_TOKEN'
            });
        }

        // Additional check: Verify user still exists and session is valid
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                message: 'User not found',
                errorCode: 'USER_NOT_FOUND'
            });
        }

        // Check if session has expired (double validation)
        if (user.sessionExpiry && new Date() > new Date(user.sessionExpiry)) {
            return res.status(401).json({
                message: 'Session expired at 4 PM. Please login again.',
                errorCode: 'SESSION_EXPIRED'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(500).json({
            message: 'Server error during authentication',
            errorCode: 'AUTH_SERVER_ERROR'
        });
    }
};

module.exports = authenticateToken;
