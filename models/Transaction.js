//desktop/budget-app/server/models/Transaction.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // store user._id as string
    date: String,
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: String,
    amount: { type: Number, required: true },
    description: String,
    accountId: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
