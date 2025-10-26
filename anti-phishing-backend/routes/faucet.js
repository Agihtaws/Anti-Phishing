const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const rateLimit = require('express-rate-limit'); // For rate limiting faucet claims
const { GovernanceTokenABI } = require('../config/contract-abis'); // Import ABI

// Import Mongoose models
const { FaucetClaim } = require('../models');

// --- Faucet Configuration from .env ---
const FAUCET_AMOUNT_APGT = ethers.parseUnits(process.env.FAUCET_AMOUNT_APGT || "100", 18); // Default 100 APGT
const FAUCET_COOLDOWN_HOURS = parseInt(process.env.FAUCET_COOLDOWN_HOURS || "48"); // Default 48 hours
const FAUCET_COOLDOWN_MS = FAUCET_COOLDOWN_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds

// --- Backend Minter Wallet Setup ---
let minterWallet;
let governanceTokenContract;
let provider;

const initializeFaucet = async () => {
  try {
    if (!process.env.BACKEND_MINTER_PRIVATE_KEY) {
      throw new Error("BACKEND_MINTER_PRIVATE_KEY is not set in .env for faucet.");
    }
    if (!process.env.GOVERNANCE_TOKEN_ADDRESS) { 
      throw new Error("GOVERNANCE_TOKEN_ADDRESS is not set in .env for faucet.");
    }
    if (!process.env.BASE_SEPOLIA_RPC_URL) {
      throw new Error("BASE_SEPOLIA_RPC_URL is not set in .env for faucet.");
    }

    // Create provider
    provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
    
    // Create wallet with provider
    minterWallet = new ethers.Wallet(process.env.BACKEND_MINTER_PRIVATE_KEY, provider);
    
    // Create contract instance with connected wallet
    governanceTokenContract = new ethers.Contract(
      process.env.GOVERNANCE_TOKEN_ADDRESS,
      GovernanceTokenABI,
      minterWallet // Wallet is now connected to provider
    );
    
    console.log(`Faucet: Minter wallet ${minterWallet.address} initialized.`);
    console.log(`Faucet: Dispensing ${ethers.formatUnits(FAUCET_AMOUNT_APGT, 18)} APGT with ${FAUCET_COOLDOWN_HOURS}h cooldown.`);
  } catch (error) {
    console.error("Faucet: Failed to initialize minter wallet or contract:", error);
  }
};

// Initialize faucet when module loads
initializeFaucet();


// --- API Rate Limiting for Faucet (Separate from general API limiter) ---
const faucetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Allow 5 claims per IP in 5 minutes to prevent rapid abuse
  message: 'Too many faucet claims from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});


/**
 * @route POST /api/faucet/claim
 * @desc Allows a user to claim free APGT tokens from the faucet.
 * @access Public (but rate-limited and cooldown-checked)
 */
router.post('/claim', faucetLimiter, async (req, res) => {
  const { userAddress } = req.body;

  if (!userAddress || !ethers.isAddress(userAddress)) {
    return res.status(400).json({ message: 'Invalid user address provided.' });
  }

  // Ensure minter wallet and contract are initialized
  if (!minterWallet || !governanceTokenContract) {
    console.error("Faucet: Attempted claim before minter wallet/contract was initialized.");
    return res.status(500).json({ message: 'Faucet is not ready. Please try again later.' });
  }

  try {
    // --- Check Cooldown ---
    const lastClaim = await FaucetClaim.findOne({ userAddress: userAddress }).sort({ timestamp: -1 });
    if (lastClaim && (Date.now() - lastClaim.timestamp.getTime() < FAUCET_COOLDOWN_MS)) {
      const timeLeft = FAUCET_COOLDOWN_MS - (Date.now() - lastClaim.timestamp.getTime());
      const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
      return res.status(429).json({ message: `You can only claim every ${FAUCET_COOLDOWN_HOURS} hours. Please try again in approximately ${hoursLeft} hours.` });
    }

    // --- Mint Tokens ---
    console.log(`Faucet: Attempting to mint ${ethers.formatUnits(FAUCET_AMOUNT_APGT, 18)} APGT to ${userAddress}...`);
    const tx = await governanceTokenContract.mint(userAddress, FAUCET_AMOUNT_APGT);
    console.log(`Faucet: Transaction sent. Hash: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(); // Wait for transaction to be mined

    // --- Log Claim ---
    await FaucetClaim.create({
      userAddress: userAddress,
      amount: FAUCET_AMOUNT_APGT.toString(), // Store as string to avoid precision issues
      txHash: tx.hash,
      timestamp: new Date()
    });

    console.log(`Faucet: Successfully minted ${ethers.formatUnits(FAUCET_AMOUNT_APGT, 18)} APGT to ${userAddress}. Tx: ${tx.hash}`);
    res.status(200).json({
      message: 'APGT claimed successfully!',
      txHash: tx.hash,
      amount: ethers.formatUnits(FAUCET_AMOUNT_APGT, 18)
    });

  } catch (error) {
    console.error(`Faucet: Error claiming APGT for ${userAddress}:`, error);
    let errorMessage = 'Failed to claim APGT. Please try again.';
    if (error.message.includes('Would exceed max supply')) {
      errorMessage = 'Faucet is temporarily out of tokens (max supply reached).';
    } else if (error.message.includes('insufficient funds for gas') || error.message.includes('insufficient funds')) {
      errorMessage = 'Faucet is temporarily out of ETH for gas. Please notify the administrator.';
    } else if (error.message.includes('nonce')) {
      errorMessage = 'Transaction nonce error. Please try again in a moment.';
    }
    res.status(500).json({ message: errorMessage, error: error.message });
  }
});

module.exports = router;
