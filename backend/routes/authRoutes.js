const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isValidEmail, isValidPassword } = require('../utils/validation');

// [Viva Tip]: Separating Auth logic into a dedicated router ensures clear separation 
// of concerns and makes it easy to switch authentication strategies (e.g. to OAuth).

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        
        const emailVal = await isValidEmail(email);
        if (!emailVal.valid) return res.status(400).json({ success: false, message: emailVal.message });
        
        const passVal = isValidPassword(password);
        if (!passVal.valid) return res.status(400).json({ success: false, message: passVal.message });

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'User already exists.' });

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            email,
            password: hashedPassword,
            name: typeof name === 'string' ? [{ text: name }] : name,
            role: role || 'patient'
        });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, token, user: { id: user._id, email: user.email, name: user.name[0]?.text || '', role: user.role } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name[0]?.text || '', role: user.role } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
