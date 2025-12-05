// /desktop/budget-app/server/index.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const { Types } = mongoose;

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
    username: user.username || '',
    isVerified: user.isVerified,
    plan: user.plan,
    planSince: user.planSince,
    paymentStatus: user.paymentStatus,
    paymentProvider: user.paymentProvider,
    paymentId: user.paymentId,
    incomeCategories: user.incomeCategories || [],
    expenseCategories: user.expenseCategories || [],
    accounts: user.accounts || [],
    savingsAccounts: user.savingsAccounts || [],
    investmentTypes: user.investmentTypes || [],
    investmentPlatforms: user.investmentPlatforms || []
  };
}

// ---------- SEND OTP VIA BREVO ----------
async function sendOtpEmail(email, otp) {
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3f4f6; padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;">
        <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Why? Community · Budget Tracker</h1>
        <p style="margin:0 0 12px;font-size:13px;color:#4b5563;">Email verification code</p>
        <p style="margin:0 0 16px;font-size:13px;color:#4b5563;">Enter this code in the app to continue:</p>
        <div style="margin:12px 0;text-align:center;">
          <span style="display:inline-block;padding:10px 18px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:22px;font-weight:700;letter-spacing:6px;color:#111827;">
            ${otp}
          </span>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280;">This code is valid for 10 minutes.</p>
      </div>
    </div>
  `;

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: 'Why? Community', email: 'techsavvy.maxmaara@gmail.com' },
      to: [{ email }],
      subject: 'Your Why? Community verification code',
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

// ============================================
// ============== TRANSACTIONS API ============
// ============================================

app.get('/api/transactions', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.json([]);

  const tx = await Transaction.find({ userId });
  res.json(tx);
});

app.post('/api/transactions', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(401).json({ message: 'Missing user' });

  const {
    date,
    type,
    category,
    amount,
    description,
    accountId,
    loanParty,
    loanPurpose,
    investmentType,
    investmentPlatform,
    investmentCurrency
  } = req.body;

  const tx = await Transaction.create({
    userId,
    date,
    type,
    category,
    amount,
    description,
    accountId,
    loanParty: loanParty || '',
    loanPurpose: loanPurpose || '',
    investmentType: investmentType || '',
    investmentPlatform: investmentPlatform || '',
    investmentCurrency: investmentCurrency || ''
  });

  res.status(201).json(tx);
});

// update tx
app.put('/api/transactions/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Missing user' });
  if (!id || !Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  const tx = await Transaction.findOneAndUpdate(
    { _id: id, userId },
    req.body,
    { new: true }
  );

  if (!tx) return res.status(404).json({ message: 'Not found' });

  res.json(tx);
});

// delete tx
app.delete('/api/transactions/:id', async (req, res) => {
  const userId = req.header('x-user-id');
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Missing user' });
  if (!id || !Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  const found = await Transaction.findOneAndDelete({ _id: id, userId });
  if (!found) return res.status(404).json({ message: 'Not found' });

  res.json({ ok: true });
});

// ============================================
// =============== AUTH API ===================
// ============================================

// REQUEST OTP
app.post('/api/users/request-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ message: 'Email required' });

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      isVerified: false,
      username: '',
      plan: 'basic',
      accounts: [
        { id: 'acc-bank-1', name: 'Main Bank', currency: 'AED', type: 'bank', mandatory: true },
        { id: 'acc-cash', name: 'Cash', currency: 'AED', type: 'cash', mandatory: true }
      ],
      savingsAccounts: [],
      incomeCategories: [],
      expenseCategories: [],
      investmentTypes: [],
      investmentPlatforms: []
    });
  }

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiresAt = Date.now() + 10 * 60 * 1000;
  await user.save();

  try {
    await sendOtpEmail(email, otp);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send email' });
  }

  res.json({ ok: true });
});

// VERIFY OTP
app.post('/api/users/verify-otp', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const otp = (req.body.otp || '').trim();

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (Date.now() > user.otpExpiresAt)
    return res.status(400).json({ message: 'Code expired' });

  if (otp !== user.otp)
    return res.status(400).json({ message: 'Invalid code' });

  user.isVerified = true;
  user.otp = null;
  user.otpExpiresAt = null;
  await user.save();

  res.json(makeSafeUser(user));
});

// UPDATE PROFILE
app.post('/api/users/update-profile', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (req.body.username !== undefined)
    user.username = req.body.username.trim();

  if (req.body.accounts) user.accounts = req.body.accounts;
  if (req.body.savingsAccounts) user.savingsAccounts = req.body.savingsAccounts;
  if (req.body.incomeCategories) user.incomeCategories = req.body.incomeCategories;
  if (req.body.expenseCategories) user.expenseCategories = req.body.expenseCategories;
  if (req.body.investmentTypes) user.investmentTypes = req.body.investmentTypes;
  if (req.body.investmentPlatforms) user.investmentPlatforms = req.body.investmentPlatforms;

  await user.save();
  res.json(makeSafeUser(user));
});

// SELECT PLAN
app.post('/api/users/select-plan', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const plan = (req.body.plan || '').trim();

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.plan = plan;
  user.planSince = Date.now();
  user.paymentStatus = 'paid';

  await user.save();

  res.json(makeSafeUser(user));
});

// ---------- START ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
