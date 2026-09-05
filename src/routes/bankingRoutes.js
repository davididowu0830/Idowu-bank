const express = require('express');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const nibssService = require('../services/nibssService');
const authenticateCustomer = require('../middleware/authMiddleware');

const router = express.Router();

// 1. Name Enquiry (Requirement 3)
router.get('/enquiry/:accountNumber', authenticateCustomer, async (req, res) => {
  const { accountNumber } = req.params;

  try {
    // Local / Intra-bank lookup first
    const localAccount = await Account.findOne({ accountNumber }).populate('userId', 'fullName');
    if (localAccount) {
      return res.json({
        accountNumber: localAccount.accountNumber,
        accountName: localAccount.userId.fullName,
        bankName: localAccount.bankName,
        bankCode: localAccount.bankCode,
        type: 'INTRA_BANK'
      });
    }

    // External / Inter-bank lookup via Nibss
    const externalAccount = await nibssService.resolveAccountName(accountNumber);
    return res.json({
      ...externalAccount,
      type: 'INTER_BANK'
    });
  } catch (err) {
    const status = err.response?.status || 404;
    const message = err.response?.data?.message || 'Recipient account not found';
    res.status(status).json({ error: message });
  }
});

// 2. Account Balance Check (Requirement 3 & 4)
router.get('/balance', authenticateCustomer, async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.user.id });
    if (!account) {
      return res.status(404).json({ error: 'No bank account found for this user.' });
    }

    res.json({
      accountNumber: account.accountNumber,
      bankCode: account.bankCode,
      bankName: account.bankName,
      balance: account.balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Funds Transfer (Requirement 3)
router.post('/transfer', authenticateCustomer, async (req, res) => {
  const { recipientAccount, amount, narration } = req.body;
  const transferAmount = Number(amount);

  if (!recipientAccount || !transferAmount || transferAmount <= 0) {
    return res.status(400).json({ error: 'A valid recipient account and positive amount are required.' });
  }

  try {
    const senderAccount = await Account.findOne({ userId: req.user.id });
    if (!senderAccount) {
      return res.status(404).json({ error: 'Sender account not found.' });
    }

    if (senderAccount.accountNumber === recipientAccount) {
      return res.status(400).json({ error: 'You cannot transfer funds to your own account.' });
    }

    if (senderAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    const localRecipient = await Account.findOne({ accountNumber: recipientAccount });

    // Intra-bank transfer
    if (localRecipient) {
      const txId = `INTRA_${Date.now()}`;

      await Account.updateOne({ _id: senderAccount._id }, { $inc: { balance: -transferAmount } });
      await Account.updateOne({ _id: localRecipient._id }, { $inc: { balance: transferAmount } });

      const transaction = await Transaction.create({
        transactionId: txId,
        senderAccount: senderAccount.accountNumber,
        recipientAccount,
        amount: transferAmount,
        type: 'INTRA_BANK',
        status: 'SUCCESS',
        narration: narration || 'Intra-bank Transfer'
      });

      return res.json({
        message: 'Intra-bank transfer successful',
        transactionId: transaction.transactionId,
        amount: transferAmount,
        from: senderAccount.accountNumber,
        to: recipientAccount,
        status: 'SUCCESS'
      });
    }

    // Inter-bank transfer (NibssByPhoenix)
    await Account.updateOne({ _id: senderAccount._id }, { $inc: { balance: -transferAmount } });

    let nibssResult;
    try {
      nibssResult = await nibssService.executeInterbankTransfer(
        senderAccount.accountNumber,
        recipientAccount,
        transferAmount
      );
    } catch (extErr) {
      // Revert sender balance on failure
      await Account.updateOne({ _id: senderAccount._id }, { $inc: { balance: transferAmount } });
      const status = extErr.response?.status || 502;
      const message = extErr.response?.data?.message || 'External bank transfer failed';
      return res.status(status).json({ error: message });
    }

    const txId = nibssResult.transactionId || `TX_${Date.now()}`;
    const transaction = await Transaction.create({
      transactionId: txId,
      senderAccount: senderAccount.accountNumber,
      recipientAccount,
      amount: transferAmount,
      type: 'INTER_BANK',
      status: nibssResult.status || 'SUCCESS',
      narration: narration || 'Inter-bank Transfer'
    });

    return res.json({
      message: 'Inter-bank transfer successful',
      transactionId: transaction.transactionId,
      amount: transferAmount,
      from: senderAccount.accountNumber,
      to: recipientAccount,
      status: transaction.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Transaction Status Check (TSQ) (Requirement 3)
router.get('/transaction/:transactionId', authenticateCustomer, async (req, res) => {
  const { transactionId } = req.params;

  try {
    const localTx = await Transaction.findOne({ transactionId });
    if (localTx) {
      return res.json(localTx);
    }

    const externalTx = await nibssService.queryTransactionStatus(transactionId);
    return res.json(externalTx);
  } catch (err) {
    const status = err.response?.status || 404;
    const message = err.response?.data?.message || 'Transaction record not found';
    res.status(status).json({ error: message });
  }
});

// 5. Transaction History & Data Privacy (Requirement 4)
router.get('/history', authenticateCustomer, async (req, res) => {
  try {
    const account = await Account.findOne({ userId: req.user.id });
    if (!account) {
      return res.status(404).json({ error: 'No account linked to this customer.' });
    }

    // Strictly fetch records for this customer's account only
    const transactions = await Transaction.find({
      $or: [
        { senderAccount: account.accountNumber },
        { recipientAccount: account.accountNumber }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      accountNumber: account.accountNumber,
      total: transactions.length,
      transactions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;