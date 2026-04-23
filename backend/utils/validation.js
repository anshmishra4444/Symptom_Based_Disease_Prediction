const dns = require('node:dns').promises;

const ALLOWED_COMMON_DOMAINS = new Set([
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 
    'live.com', 'me.com', 'msn.com', 'aim.com', 'aol.com', 'ymail.com'
]);

const isValidEmail = async (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
        return { valid: false, message: "Invalid email format." };
    }

    const domain = email.split('@')[1].toLowerCase();
    if (ALLOWED_COMMON_DOMAINS.has(domain)) return { valid: true };

    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) return { valid: true };
        return { valid: false, message: `The domain "${domain}" is not configured for email.` };
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            return { valid: false, message: `The domain "${domain}" was not found.` };
        }
        return { valid: true }; // Fail open for network errors
    }
};

const isValidPassword = (password) => {
    if (!password || password.length < 8) {
        return { valid: false, message: "Password must be >= 8 chars." };
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return { valid: false, message: "Password requires Upper, Lower, Number, and Special char." };
    }
    return { valid: true };
};

module.exports = { isValidEmail, isValidPassword };
