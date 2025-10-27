require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Import cors
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit');
const startBlockchainIndexer = require('./services/blockchainIndexer');
const models = require('./models');

// Import your routers
const ipfsRoutes = require('./routes/ipfs');
const dataRoutes = require('./routes/data');
const faucetRoutes = require('./routes/faucet');

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
  'BACKEND_MINTER_PRIVATE_KEY',
  'GOVERNANCE_TOKEN_ADDRESS',
  'FAUCET_AMOUNT_APGT',
  'FAUCET_COOLDOWN_HOURS',
  'FRONTEND_DAPP_URL' // NEW: Add frontend URL to required env vars
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

// --- CORS Configuration ---
// Use a more specific CORS configuration to allow requests ONLY from your frontend dApp URL
const corsOptions = {
  origin: process.env.FRONTEND_DAPP_URL, // Allow requests from your deployed frontend dApp
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow cookies to be sent (if your API uses them)
  optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 200
};
app.use(cors(corsOptions)); // Apply CORS with specific options

app.use(express.json());

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
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
app.use('/api/faucet', faucetRoutes);

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connected to blockchain via RPC: ${process.env.BASE_SEPOLIA_RPC_URL}`);
});

module.exports = {
  ...models,
};
