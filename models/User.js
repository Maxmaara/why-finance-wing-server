// /desktop/budget-app/server/models/User.js

const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    currency: String,
    type: String,
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

    username: { type: String, default: '' },

    plan: { type: String, default: 'basic' },
    planSince: Date,

    paymentStatus: { type: String, default: 'unpaid' },
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

    // per-user investment meta (user controls, no defaults)
    investmentTypes: {
      type: [String],
      default: []
    },
    investmentPlatforms: {
      type: [String],
      default: []
    },

    accounts: { type: [AccountSchema], default: [] },
    savingsAccounts: { type: [AccountSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
