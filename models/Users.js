//desktop/budget-app/server/models/User.js:

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: String,
  otpExpiresAt: Date,
  isVerified: { type: Boolean, default: false },

  plan: { type: String, default: 'basic' },
  planSince: Date,
  paymentStatus: { type: String, default: 'unpaid' },
  paymentProvider: { type: String, default: 'none' },
  paymentId: String,

  incomeCategories: { type: [String], default: ['Salary','Bonus','Business','Other income'] },
  expenseCategories: { type: [String], default: ['Rent','Groceries','Utilities','Transport','Other expense'] },

  accounts: {
    type: Array,
    default: [
      { id: 'acc-bank-1', name: 'Main Bank', currency: 'AED', type: 'bank', mandatory: true },
      { id: 'acc-cash', name: 'Cash', currency: 'AED', type: 'cash', mandatory: true }
    ]
  },

  savingsAccounts: { type: Array, default: [] }
});

module.exports = mongoose.model('User', UserSchema);
