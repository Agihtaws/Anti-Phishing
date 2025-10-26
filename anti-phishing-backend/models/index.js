const mongoose = require('mongoose');

// --- Schema for Blacklist Entries ---
const blacklistEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['URL', 'Address'],
    required: true
  },
  value: { // The actual URL string or Address string
    type: String,
    required: true,
    unique: true // Ensure uniqueness for blacklisted items
  },
  proposer: { // The address that originally proposed it
    type: String,
    required: true
  },
  timestamp: { // When it was added to the blockchain blacklist
    type: Date,
    required: true
  },
  isActive: { // To mark if an entry is currently active (not removed)
    type: Boolean,
    default: true
  }
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt fields

const BlacklistEntry = mongoose.model('BlacklistEntry', blacklistEntrySchema);


// --- Schema for Proposals ---
const proposalSchema = new mongoose.Schema({
  proposalId: { // Corresponds to the ID in your smart contract
    type: Number,
    required: true,
    unique: true
  },
  proposalType: {
    type: String,
    enum: ['AddURL', 'AddAddress', 'RemoveURL', 'RemoveAddress'],
    required: true
  },
  urlValue: {
    type: String
  },
  addressValue: {
    type: String
  },
  description: {
    type: String,
    required: true
  },
  creationTimestamp: {
    type: Date,
    required: true
  },
  votingPeriodEnd: {
    type: Date,
    required: true
  },
  proposer: {
    type: String,
    required: true
  },
  yesVotes: {
    type: Number,
    default: 0
  },
  noVotes: {
    type: Number,
    default: 0
  },
  totalVoters: { // Total unique addresses that voted
    type: Number,
    default: 0
  },
  status: { // Corresponds to ProposalStatus enum in contract
    type: String,
    enum: ['Active', 'Approved', 'Rejected', 'Executed'],
    default: 'Active'
  }
}, { timestamps: true });

const Proposal = mongoose.model('Proposal', proposalSchema);


// --- Schema for Votes ---
const voteSchema = new mongoose.Schema({
  proposalId: {
    type: Number,
    required: true
  },
  voter: { // Address of the voter
    type: String,
    required: true
  },
  support: { // True for 'yes', false for 'no'
    type: Boolean,
    required: true
  },
  timestamp: { // When the vote was cast on-chain
    type: Date,
    required: true
  }
}, { timestamps: true });


// Compound unique index to prevent duplicate votes for a single voter on a single proposal
voteSchema.index({ proposalId: 1, voter: 1 }, { unique: true });

const Vote = mongoose.model('Vote', voteSchema);

const faucetClaimSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    index: true // Index for efficient lookup during cooldown checks
  },
  amount: { // Store as string to preserve BigInt precision
    type: String,
    required: true
  },
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { timestamps: true });

const FaucetClaim = mongoose.model('FaucetClaim', faucetClaimSchema);

module.exports = {
  BlacklistEntry,
  Proposal,
  Vote,
  FaucetClaim // Export the new model
};