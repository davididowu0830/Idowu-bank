const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const customerRoutes = require('./routes/customerRoutes');
const bankingRoutes = require('./routes/bankingRoutes');

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/customer', customerRoutes);
app.use('/api/banking', bankingRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    bank: process.env.MY_BANK_NAME,
    code: process.env.MY_BANK_CODE
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Bank Name: ${process.env.MY_BANK_NAME} (Code: ${process.env.MY_BANK_CODE})`);
});