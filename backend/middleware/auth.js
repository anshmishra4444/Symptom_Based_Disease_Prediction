const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Clinical context missing. Please re-authenticate.' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid session token.' });
    }
};

const doctorMiddleware = async (req, res, next) => {
    // Requires req.user to be populated or verified
    // To keep it clean, we usually verify role here
    next();
};

module.exports = { authMiddleware, doctorMiddleware };
