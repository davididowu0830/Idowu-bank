const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  accountNumber: { type: String, required: true, unique: true },
  bankCode: { type: String, required: true, default: '913' },
  bankName: { type: String, required: true, default: 'IDO Bank' },
  balance: { type: Number, required: true, default: 15000.00 }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);