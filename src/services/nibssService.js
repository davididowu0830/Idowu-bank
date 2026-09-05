const axios = require('axios');
require('dotenv').config();

let cachedToken = null;
let tokenExpiresAt = 0;

// Authenticate with NibssByPhoenix and cache the JWT token
async function getAuthToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 60) {
    return cachedToken;
  }

  const response = await axios.post(`${process.env.NIBSS_BASE_URL}/api/auth/token`, {
    apiKey: process.env.NIBSS_API_KEY,
    apiSecret: process.env.NIBSS_API_SECRET
  });

  cachedToken = response.data.token;
  tokenExpiresAt = now + 3500; // 1-hour expiry window
  return cachedToken;
}

async function getAuthorizedClient() {
  const token = await getAuthToken();
  return axios.create({
    baseURL: process.env.NIBSS_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });
}

// 1. Seed identity records (BVN or NIN)
async function insertBvn(data) {
  const client = await getAuthorizedClient();
  const res = await client.post('/api/insertBvn', data);
  return res.data;
}

async function insertNin(data) {
  const client = await getAuthorizedClient();
  const res = await client.post('/api/insertNin', data);
  return res.data;
}

// 2. Validate BVN or NIN
async function validateIdentity(type, number) {
  const client = await getAuthorizedClient();
  const endpoint = type.toLowerCase() === 'bvn' ? '/api/validateBvn' : '/api/validateNin';
  const payload = type.toLowerCase() === 'bvn' ? { bvn: number } : { nin: number };
  const res = await client.post(endpoint, payload);
  return res.data;
}

// 3. Create Account on Nibss platform
async function createNibssAccount(kycType, kycID, dob) {
  const client = await getAuthorizedClient();
  const res = await client.post('/api/account/create', {
    kycType: kycType.toLowerCase(),
    kycID,
    dob
  });
  return res.data;
}

// 4. Name Enquiry
async function resolveAccountName(accountNumber) {
  const client = await getAuthorizedClient();
  const res = await client.get(`/api/account/name-enquiry/${accountNumber}`);
  return res.data;
}

// 5. Inter-bank Fund Transfer
async function executeInterbankTransfer(from, to, amount) {
  const client = await getAuthorizedClient();
  const res = await client.post('/api/transfer', {
    from: String(from),
    to: String(to),
    amount: String(amount)
  });
  return res.data;
}

// 6. TSQ - Transaction Status Query
async function queryTransactionStatus(txId) {
  const client = await getAuthorizedClient();
  const res = await client.get(`/api/transaction/${txId}`);
  return res.data;
}

module.exports = {
  insertBvn,
  insertNin,
  validateIdentity,
  createNibssAccount,
  resolveAccountName,
  executeInterbankTransfer,
  queryTransactionStatus
};