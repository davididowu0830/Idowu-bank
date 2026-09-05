const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Account = require('../models/Account');
const nibssService = require('../services/nibssService');
const authenticateCustomer = require('../middleware/authMiddleware');

const router = express.Router();

// 1. Seed a mock identity directly into Nibss (test helper)
router.post('/seed-identity', async (req, res) => {
  const { type, ...payload } = req.body;
  try {
    const result = (type && type.toLowerCase() === 'bvn')
      ? await nibssService.insertBvn(payload)
      : await nibssService.insertNin(payload);
    res.status(201).json(result);
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.response?.data || err.message;
    res.status(status).json({ error: message });
  }
});

// 2. Customer Onboarding (Requirement 1: Identity verification prior to account creation)
router.post('/onboard', async (req, res) => {
  const { fullName, email, password, kycType, kycId, dob } = req.body;

  if (!fullName || !email || !password || !kycType || !kycId || !dob) {
    return res.status(400).json({ error: 'All fields are required (fullName, email, password, kycType, kycId, dob).' });
  }

  try {
    // Verify BVN or NIN with NibssByPhoenix
    const validation = await nibssService.validateIdentity(kycType, kycId);
    console.log('NIBSS Validation Result:', validation);

    const isValid = validation && (
      validation.valid === true ||
      validation.status === 'success' ||
      validation.success === true ||
      Boolean(validation.bvn) ||
      Boolean(validation.nin) ||
      Boolean(validation.data)
    );

    if (!isValid) {
      return res.status(400).json({
        error: `${kycType.toUpperCase()} verification failed with NIBSS.`,
        details: validation
      });
    }

    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { kycId }] });
    if (existingUser) {
      return res.status(409).json({ error: 'Email or KYC ID is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      kycType: kycType.toLowerCase(),
      kycId,
      dob
    });

    res.status(201).json({
      message: 'Customer onboarded successfully. You may now log in.',
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        kycType: newUser.kycType,
        kycId: newUser.kycId
      }
    });
  } catch (err) {
    console.error('NIBSS Verification Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.response?.data?.error || err.message;
    res.status(status).json({ error: message });
  }
});

// 3. Customer Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email ? email.toLowerCase() : '' });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create Account (Requirement 2: Max 1 account per customer, pre-funded with ₦15,000)
router.post('/accounts/create', authenticateCustomer, async (req, res) => {
  const userId = req.user.id;

  try {
    const existingAccount = await Account.findOne({ userId });
    if (existingAccount) {
      return res.status(400).json({ error: 'Customer already has an active account. Only 1 account is permitted.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    const nibssAccount = await nibssService.createNibssAccount(user.kycType, user.kycId, user.dob);
    console.log('NIBSS Create Account Response:', nibssAccount);

    // Extract accountNumber from various possible response formats
    const generatedAccountNumber =
      nibssAccount.accountNumber ||
      nibssAccount.account_number ||
      nibssAccount.data?.accountNumber ||
      nibssAccount.data?.account_number ||
      nibssAccount.account?.accountNumber ||
      nibssAccount.account?.account_number;

    if (!generatedAccountNumber) {
      return res.status(502).json({
        error: 'Failed to retrieve account number from NIBSS.',
        details: nibssAccount
      });
    }

    const bankCode =
      nibssAccount.bankCode ||
      nibssAccount.bank_code ||
      nibssAccount.data?.bankCode ||
      process.env.MY_BANK_CODE ||
      '913';

    const bankName =
      nibssAccount.bankName ||
      nibssAccount.bank_name ||
      nibssAccount.data?.bankName ||
      process.env.MY_BANK_NAME ||
      'IDO Bank';

    const newAccount = await Account.create({
      userId: user._id,
      accountNumber: String(generatedAccountNumber),
      bankCode: String(bankCode),
      bankName: String(bankName),
      balance: 15000.00
    });

    res.status(201).json({
      message: 'Account created and pre-funded with ₦15,000 successfully.',
      account: {
        accountNumber: newAccount.accountNumber,
        bankCode: newAccount.bankCode,
        bankName: newAccount.bankName,
        balance: newAccount.balance
      }
    });
  } catch (err) {
    console.error('Account Creation Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || err.message;
    res.status(status).json({ error: message });
  }
});

module.exports = router;