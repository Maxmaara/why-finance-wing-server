// /desktop/budget-app/server/models/Transaction.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // date string "YYYY-MM-DD"
    date: { type: String, required: true },

    // now also allows "return"
    type: { type: String, enum: ['income', 'expense', 'return'], required: true },

    category: { type: String, required: true },

    amount: { type: Number, required: true },
    description: { type: String },

    accountId: { type: String, required: true },

    // loans
    loanParty: { type: String, default: '' },
    loanPurpose: { type: String, default: '' },

    // investments
    investmentType: { type: String, default: '' },
    investmentPlatform: { type: String, default: '' },
    investmentCurrency: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
