//desktop/budget-app/server/index.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

// ---------- CONNECT MONGO ----------
mongoose
  .connect(process.env.MONGODB_URI, { dbName: 'whybudget' })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo error:', err));

// ---------- MODELS ----------
const User = require('./models/User');
const Transaction = require('./models/Transaction');

// ---------- APP ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- HELPERS ----------
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function makeSafeUser(user) {
  return {
    id: user._id,
    email: user.email,
    isVerified: user.isVerified,
    plan: user.plan,
    planSince: user.planSince,
    paymentStatus: user.paymentStatus,
    paymentProvider: user.paymentProvider,
    paymentId: user.paymentId,
    incomeCategories: user.incomeCategories,
    expenseCategories: user.expenseCategories,
    accounts: user.accounts,
    savingsAccounts: user.savingsAccounts
  };
}

// ---------- SEND OTP VIA BREVO API ----------
async function sendOtpEmail(email, otp) {
  const html = `
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
            Use this one-time verification code to continue signing in.
          </p>

          <div style="margin:18px 0;text-align:center;">
            <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:#fef9c3;color:#111827;font-size:22px;font-weight:700;letter-spacing:6px;box-shadow:0 18px 40px rgba(245,179,0,0.4);">
              ${otp}
            </div>
          </div>

          <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
            Code valid for <span style="color:#facc15;">10 minutes</span>.
          </p>
        </div>

        <div style="padding:10px 20px 14px;border-top:1px solid rgba(31,41,55,0.9);background:#020617;color:#6b7280;font-size:10px;text-align:center;">
          © ${new Date().getFullYear()} Why? Community · Budget Tracker
        </div>
      </div>
    </div>
  `;

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: "Why? Community", email: "techsavvy.maxmaara@gmail.com" },
      to: [{ email }],
      subject: "Your Why? Community verification code",
      htmlContent: html
    },
    {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
}

// ---------- TRANSACTIONS ----------
app.get('/api/transactions', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.json([]);

  const tx = await Transaction.find({ userId });
  res.json(tx);
});

app.post('/api/transactions', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const tx = await Transaction.create({
    userId,
    date: req.body.date,
    type: req.body.type,
    category: req.body.category,
    amount: req.body.amount,
    description: req.body.description,
    accountId: req.body.accountId
  });

  res.status(201).json(tx);
});

app.put('/api/transactions/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const tx = await Transaction.findOneAndUpdate(
    { _id: req.params.id, userId },
    req.body,
    { new: true }
  );

  if (!tx) return res.status(404).json({ message: 'Not found' });
  res.json(tx);
});

app.delete('/api/transactions/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const found = await Transaction.findOneAndDelete({ _id: req.params.id, userId });
  if (!found) return res.status(404).json({ message: 'Not found' });

  res.json({ ok: true });
});

// ---------- OTP REQUEST ----------
app.post('/api/users/request-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email required' });

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      isVerified: false,
      plan: 'basic',
      accounts: [
        { id: 'acc-bank-1', name: 'Main Bank', currency: 'AED', type: 'bank', mandatory: true },
        { id: 'acc-cash', name: 'Cash', currency: 'AED', type: 'cash', mandatory: true }
      ],
      savingsAccounts: []
    });
  }

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
  await user.save();

  try {
    await sendOtpEmail(email, otp);
  } catch (e) {
    console.error('Brevo API error:', e?.response?.data || e);
    return res.status(500).json({ message: 'Email send failed' });
  }

  res.json({ ok: true });
});

// ---------- OTP VERIFY ----------
app.post('/api/users/verify-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const otp = (req.body.otp || '').trim();
  if (!email || !otp) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findOne({ email });
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
  await user.save();

  res.json(makeSafeUser(user));
});

// ---------- UPDATE PROFILE ----------
app.post('/api/users/update-profile', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (req.body.incomeCategories) user.incomeCategories = req.body.incomeCategories;
  if (req.body.expenseCategories) user.expenseCategories = req.body.expenseCategories;
  if (req.body.accounts) user.accounts = req.body.accounts;
  if (req.body.savingsAccounts) user.savingsAccounts = req.body.savingsAccounts;

  await user.save();
  res.json(makeSafeUser(user));
});

// ---------- PLAN SELECT ----------
app.post('/api/users/select-plan', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const plan = (req.body.plan || '').trim().toLowerCase();
  if (!email || !plan) return res.status(400).json({ message: 'Missing data' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.plan = plan;
  user.planSince = Date.now();
  user.paymentStatus = 'paid';

  await user.save();
  res.json(makeSafeUser(user));
});

// ---------- SERVER ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
