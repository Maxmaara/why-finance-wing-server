//desktop/budget-app/server/models/User.js:

const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    currency: String,
    type: String,      // 'bank' | 'cash' | 'savings'
    mandatory: Boolean
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    isVerified: { type: Boolean, default: false },

    otp: String,
    otpExpiresAt: Date,

    plan: { type: String, default: 'basic' }, // 'basic' | 'pro' | 'enterprise'
    planSince: Date,

    paymentStatus: { type: String, default: 'unpaid' }, // 'unpaid' | 'paid'
    paymentProvider: String,
    paymentId: String,

    incomeCategories: {
      type: [String],
      default: ['Salary', 'Bonus', 'Business', 'Other income']
    },
    expenseCategories: {
      type: [String],
      default: ['Rent', 'Groceries', 'Utilities', 'Transport', 'Other expense']
    },

    accounts: { type: [AccountSchema], default: [] },
    savingsAccounts: { type: [AccountSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
