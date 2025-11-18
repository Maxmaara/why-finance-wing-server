//desktop/budget-app/server/index.js

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let transactions = [];
let users = [];

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});


// -------- TRANSACTIONS --------
app.get('/api/transactions', (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.json([]); // not logged in → no data for now

  const userTx = transactions.filter((t) => t.userId === userId);
  res.json(userTx);
});


app.post('/api/transactions', (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const tx = {
    id: Date.now().toString(),
    userId, // 👈 important
    date: req.body.date || '',
    type: req.body.type === 'income' ? 'income' : 'expense',
    category: req.body.category || '',
    amount: Number(req.body.amount) || 0,
    description: req.body.description || '',
    accountId: req.body.accountId || 'default'
  };
  transactions.push(tx);
  res.status(201).json(tx);
});


app.put('/api/transactions/:id', (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const id = req.params.id;
  const idx = transactions.findIndex((t) => t.id === id && t.userId === userId);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });

  const existing = transactions[idx];
  // ... rest stays same
  const updated = {
    ...existing,
    date: req.body.date ?? existing.date,
    type: req.body.type ?? existing.type,
    category: req.body.category ?? existing.category,
    amount:
      typeof req.body.amount === 'number'
        ? req.body.amount
        : existing.amount,
    description: req.body.description ?? existing.description,
    accountId: req.body.accountId ?? existing.accountId
  };
  transactions[idx] = updated;
  res.json(updated);
});

app.delete('/api/transactions/:id', (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const id = req.params.id;
  const before = transactions.length;
  transactions = transactions.filter((t) => !(t.id === id && t.userId === userId));
  if (transactions.length === before) {
    return res.status(404).json({ message: 'Not found' });
  }
  res.json({ ok: true });
});


// -------- USERS + OTP --------
app.post('/api/users/request-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email required' });

  let user = users.find((u) => u.email === email);
  if (!user) {
    user = {
      id: Date.now().toString(),
      email,
      username: '',
      isVerified: false,
      otp: null,
      otpExpiresAt: null
    };
    users.push(user);
  }

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  try {
    await transporter.sendMail({
      from: '"Why? Community · Budget Tracker" <no-reply@whycommunity.org>',
      to: email,
      subject: 'Your Why? Community verification code',
      html: `
        <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:16px;border:1px solid rgba(148,163,184,0.4);box-shadow:0 20px 45px rgba(15,23,42,0.8);overflow:hidden;">
            <div style="padding:16px 20px;border-bottom:1px solid rgba(30,64,175,0.7);background:radial-gradient(circle at top,#0f172a,#020617);display:flex;align-items:center;gap:12px;">
              <div style="width:32px;height:32px;border-radius:10px;background:#f5b300;display:flex;align-items:center;justify-content:center;font-weight:800;color:#020617;font-size:16px;box-shadow:0 10px 25px rgba(245,179,0,0.5);">
                W?
              </div>
              <div>
                <div style="font-size:15px;font-weight:600;color:#e5e7eb;">Why? Community</div>
                <div style="font-size:11px;color:#9ca3af;">Budget Tracker · Email verification</div>
              </div>
            </div>

            <div style="padding:20px 20px 16px;color:#e5e7eb;background:#020617;">
              <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#fef9c3;">Confirm your email</h2>
              <p style="margin:0 0 14px;font-size:13px;color:#cbd5f5;">
                Use this one-time verification code to continue signing in to your Why? Community Budget Tracker.
              </p>

              <div style="margin:18px 0;text-align:center;">
                <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:#fef9c3;color:#111827;font-size:22px;font-weight:700;letter-spacing:6px;box-shadow:0 18px 40px rgba(245,179,0,0.4);">
                  ${otp}
                </div>
              </div>

              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                This code is valid for <span style="color:#facc15;">10 minutes</span> and can be used only once.
              </p>
              <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">
                If you didn’t request this, you can safely ignore this email.
              </p>
            </div>

            <div style="padding:10px 20px 14px;border-top:1px solid rgba(31,41,55,0.9);background:#020617;color:#6b7280;font-size:10px;text-align:center;">
              © ${new Date().getFullYear()} Why? Community · Budget Tracker
            </div>
          </div>
        </div>
      `
    });
  } catch (e) {
    console.error('Email error', e.message);
    return res.status(500).json({ message: 'Email send failed' });
  }

  res.json({ ok: true });
});

app.post('/api/users/verify-otp', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const otp = (req.body.otp || '').trim();
  if (!email || !otp) return res.status(400).json({ message: 'Missing data' });

  const user = users.find((u) => u.email === email);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.otp || !user.otpExpiresAt)
    return res.status(400).json({ message: 'No active code' });
  if (Date.now() > user.otpExpiresAt)
    return res.status(400).json({ message: 'Code expired' });
  if (user.otp !== otp)
    return res.status(400).json({ message: 'Invalid code' });

  user.isVerified = true;
  user.otp = null;
  user.otpExpiresAt = null;

  const safeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    isVerified: user.isVerified
  };
  res.json(safeUser);
});

app.post('/api/users/update-profile', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const username = req.body.username || '';
  if (!email) return res.status(400).json({ message: 'Email required' });

  const user = users.find((u) => u.email === email);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.username = username;

  const safeUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    isVerified: user.isVerified
  };
  res.json(safeUser);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

