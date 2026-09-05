const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  senderAccount: { type: String, required: true },
  recipientAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['INTRA_BANK', 'INTER_BANK'], required: true },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'SUCCESS' },
  narration: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);