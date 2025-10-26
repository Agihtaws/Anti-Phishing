require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const startBlockchainIndexer = require('./services/blockchainIndexer');
const models = require('./models');

// Import your routers
const ipfsRoutes = require('./routes/ipfs');
const dataRoutes = require('./routes/data');
const faucetRoutes = require('./routes/faucet'); // NEW: Import faucet routes

const app = express();
const PORT = process.env.PORT || 5000;

// --- Environment Variable Validation ---
const requiredEnv = [
  'MONGODB_URI',
  'BASE_SEPOLIA_RPC_URL',
  'BLACKLIST_REGISTRY_ADDRESS',
  'PROPOSAL_VOTING_ADDRESS',
  'PINATA_API_KEY',
  'PINATA_SECRET_API_KEY',
  'PINATA_JWT',
  'BACKEND_MINTER_PRIVATE_KEY', // NEW: Required for faucet
  'GOVERNANCE_TOKEN_ADDRESS', // NEW: Required for faucet to know token address
  'FAUCET_AMOUNT_APGT', // NEW: Faucet config
  'FAUCET_COOLDOWN_HOURS' // NEW: Faucet config
];

requiredEnv.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Error: Missing required environment variable - ${envVar}`);
    process.exit(1);
  }
});

// --- API Rate Limiting (General) ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(apiLimiter);


// Middleware
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    // Start indexer. The provider is also exported from indexer, so faucet can use it.
    startBlockchainIndexer(provider); 
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

// --- API Routes ---
app.get('/', (req, res) => {
  res.send('Anti-Phishing Backend is Running!');
});

app.use('/api/ipfs', ipfsRoutes);
app.use('/api', dataRoutes);
app.use('/api/faucet', faucetRoutes); // NEW: Integrate faucet routes

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connected to blockchain via RPC: ${process.env.BASE_SEPOLIA_RPC_URL}`);
});

module.exports = {
  ...models,
};
