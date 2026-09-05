const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  kycType: { type: String, enum: ['bvn', 'nin'], required: true },
  kycId: { type: String, required: true, unique: true },
  dob: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);