//desktop/budget-app/server/models/Transaction.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: String,
  type: String,
  category: String,
  amount: Number,
  description: String,
  accountId: String
});

module.exports = mongoose.model('Transaction', TransactionSchema);
