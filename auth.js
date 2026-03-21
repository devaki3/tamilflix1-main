const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

let db;

function setDb(database) {
  db = database;
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Email transporter using Brevo SMTP
function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Validate Gmail format
function isValidGmail(email) {
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  return gmailRegex.test(email);
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!isValidGmail(email)) {
      return res.status(400).json({ error: 'Please use a valid Gmail address (@gmail.com)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = db.prepare('SELECT id, is_verified FROM users WHERE email = ?').get(email);
    
    if (existingUser && existingUser.is_verified) {
      return res.status(400).json({ error: 'Email already registered. Please login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (existingUser && !existingUser.is_verified) {
      db.prepare(`UPDATE users SET name=?, password=?, otp=?, otp_expires=? WHERE email=?`)
        .run(name, hashedPassword, otp, otpExpires, email);
    } else {
      db.prepare(`INSERT INTO users (name, email, password, otp, otp_expires) VALUES (?, ?, ?, ?, ?)`)
        .run(name, email, hashedPassword, otp, otpExpires);
    }

    // Send OTP email via Brevo
    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"PadamPaapoma 🎬" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your PadamPaapoma OTP Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #a855f7; text-align: center;">🎬 PadamPaapoma</h1>
            <h2 style="text-align: center;">Email Verification</h2>
            <p>Hello ${name},</p>
            <p>Your OTP verification code is:</p>
            <div style="background: #1a1a1a; border: 2px solid #a855f7; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #a855f7;">${otp}</span>
            </div>
            <p style="color: #888;">This code expires in <strong style="color: #fff;">10 minutes</strong>.</p>
            <p style="color: #888;">If you didn't request this, please ignore this email.</p>
          </div>
        `
      });
      console.log(`📧 OTP sent to ${email}`);
    } catch (emailErr) {
      console.error('Email error:', emailErr.message);
    }

    res.json({ 
      message: 'OTP sent to your email. Please verify to complete signup.',
      email
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    if (Date.now() > user.otp_expires) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Verify the user
    db.prepare('UPDATE users SET is_verified=1, otp=NULL, otp_expires=NULL WHERE email=?').run(email);

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'tamilflix_secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully! Welcome to PadamPaapoma!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_verified) {
      return res.status(401).json({ error: 'Please verify your email first', needsVerification: true, email });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'tamilflix_secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || user.is_verified) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    db.prepare('UPDATE users SET otp=?, otp_expires=? WHERE email=?').run(otp, otpExpires, email);

    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"PadamPaapoma 🎬" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'PadamPaapoma - New OTP Code',
        html: `<div style="background:#0a0a0a;color:#fff;padding:40px;border-radius:12px;text-align:center;">
          <h1 style="color:#a855f7;">🎬 PadamPaapoma</h1>
          <p>Your new OTP: <strong style="font-size:28px;color:#a855f7;">${otp}</strong></p>
          <p style="color:#888;">Expires in 10 minutes</p>
        </div>`
      });
      console.log(`📧 Resent OTP to ${email}`);
    } catch (e) {
      console.error('Resend email error:', e.message);
    }

    res.json({ message: 'New OTP sent!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setDb };
