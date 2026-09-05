# IDO Bank — Core Banking & Settlement Engine

A robust digital banking backend API built with **Node.js**, **Express**, and **MongoDB Atlas**, featuring real-time identity validation and interbank payment routing integrated with the **NibssByPhoenix** platform.

---

## 📌 Project Overview

This service implements core banking capabilities designed around regulatory compliance and multi-tenant security:
- **KYC & Identity Verification**: Mandatory BVN/NIN validation against NIBSS records before customer onboarding.
- **Account Provisioning**: Automated NUBAN generation mapped to Bank Code `913` with strict single-account limits and automatic opening balance provisioning.
- **Transaction Processing**: Real-time name enquiry, atomic ledger operations for internal transfers, and external interbank settlement routing.
- **Auditing & Privacy**: Tenant-isolated transaction statements protected by JSON Web Token (JWT) session security.

---

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Cloud) via Mongoose ODM
- **Security & Auth**: JSON Web Tokens (JWT), Bcrypt.js (Password Hashing)
- **External Integration**: NibssByPhoenix REST APIs (Identity & Settlement Engine)
- **HTTP Client**: Axios

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root directory with the following variables:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/digital_banking?retryWrites=true&w=majority
JWT_SECRET=super_secret_bank_key_2026

# NibssByPhoenix Credentials
NIBSS_BASE_URL=[https://nibssbyphoenix.onrender.com](https://nibssbyphoenix.onrender.com)
NIBSS_API_KEY=0b807962bdcef69a3c509d528611dd79
NIBSS_API_SECRET=bc8f7f59fe25213c7ceea57c2f996857f5796dd0ee7ca1250b255d9f76b02414
MY_BANK_CODE=913
MY_BANK_NAME=IDO Bank
