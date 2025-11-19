// /server/index.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const { Resend } = require('resend');

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

const resend = new Resend(process.env.RESEND_API_KEY);

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
    await resend.emails.send({
      from: '"Why? Community · Budget Tracker" <onboarding@resend.dev>',
      to: email,
      subject: 'Your Why? Community verification code',
      html: `
        <div>Your OTP is: <strong>${otp}</strong></div>
      `
    });
  } catch (e) {
    console.error('Email error:', e.message);
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

// ---------- UPDATE PROFILE (CATEGORIES, ACCOUNTS) ----------
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
