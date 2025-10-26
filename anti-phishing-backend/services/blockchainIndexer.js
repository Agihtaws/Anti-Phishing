const { ethers } = require('ethers');
const { BlacklistEntry, Proposal, Vote } = require('..//models');
const { BlacklistRegistryABI, ProposalVotingABI } = require('..//config/contract-abis');

// Helper to convert blockchain timestamp (seconds) to JavaScript Date object
const toDate = (timestampInSeconds) => {
  // Ensure timestampInSeconds is a valid number before converting
  if (timestampInSeconds === null || timestampInSeconds === undefined) {
    console.warn("toDate received null/undefined timestamp, returning current date.");
    return new Date(); // Fallback to current date
  }
  // Explicitly convert to Number before multiplying
  const date = new Date(Number(timestampInSeconds) * 1000);
  if (isNaN(date.getTime())) {
    console.error("toDate received invalid timestamp, resulting in Invalid Date. Timestamp:", timestampInSeconds);
    return new Date(); // Fallback to current date
  }
  return date;
};

let provider; // Store provider reference for export

const startBlockchainIndexer = (providerInstance) => {
  provider = providerInstance; // Store the provider
  
  if (!process.env.BLACKLIST_REGISTRY_ADDRESS || !process.env.PROPOSAL_VOTING_ADDRESS) {
    console.error("Missing contract addresses in .env. Cannot start indexer.");
    return;
  }

  const blacklistRegistryContract = new ethers.Contract(
    process.env.BLACKLIST_REGISTRY_ADDRESS,
    BlacklistRegistryABI,
    provider
  );

  const proposalVotingContract = new ethers.Contract(
    process.env.PROPOSAL_VOTING_ADDRESS,
    ProposalVotingABI,
    provider
  );

  console.log("Blockchain Indexer: Starting to listen for events.");
  console.log(`  BlacklistRegistry: ${blacklistRegistryContract.target}`);
  console.log(`  ProposalVoting: ${proposalVotingContract.target}`);

  // --- BlacklistRegistry Events ---
  blacklistRegistryContract.on('EntryAdded', async (_type, _value, _address, _timestamp, _proposer, event) => {
    try {
      console.log("--- DEBUG: Raw EntryAdded Event Data Received by Indexer ---");
      console.log("Raw _type:", _type, " (Type:", typeof _type, ")"); // Expecting 0 (for URL), check its type
      console.log("Raw _value:", _value); // Expecting URL string
      console.log("Raw _address:", _address); // Expecting 0x00...0000
      console.log("Raw _timestamp:", _timestamp);
      console.log("Raw _proposer:", _proposer);
      console.log("Full Event Object (for deep inspection if needed):", event);
      console.log("-------------------------------------------------------");

      // CRITICAL FIX: Explicitly convert _type to a Number for comparison
      const entryType = Number(_type) === 0 ? 'URL' : 'Address';
      const value = entryType === 'URL' ? _value : _address;

      console.log(`Indexer: Decoded Event - Type: ${entryType}, Value: ${value}`);

      await BlacklistEntry.findOneAndUpdate(
        { value: value },
        {
          type: entryType,
          value: value,
          proposer: _proposer,
          timestamp: toDate(_timestamp),
          isActive: true
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Indexer: Blacklist Entry Added (DB Save) - Type: ${entryType}, Value: ${value}`);
    } catch (error) {
      console.error(`Indexer Error processing EntryAdded event:`, error);
    }
  });

  blacklistRegistryContract.on('EntryRemoved', async (_type, _value, _address, _timestamp, _remover, event) => {
    try {
      // CRITICAL FIX: Explicitly convert _type to a Number for comparison
      const entryType = Number(_type) === 0 ? 'URL' : 'Address';
      const value = entryType === 'URL' ? _value : _address;

      await BlacklistEntry.findOneAndUpdate(
        { value: value },
        { isActive: false, timestamp: toDate(_timestamp) },
        { new: true }
      );
      console.log(`Indexer: Blacklist Entry Removed - Type: ${entryType}, Value: ${value}`);
    } catch (error) {
      console.error(`Indexer Error processing EntryRemoved event:`, error);
    }
  });

  // --- ProposalVoting Events ---
    proposalVotingContract.on('ProposalCreated', async (proposalId, _type, _url, _address, _description, _proposer, _creationTimestamp, _votingPeriodEnd, event) => {
    try {
      console.log("--- DEBUG: Raw ProposalCreated Event Data Received by Indexer ---");
      console.log("Raw proposalId:", proposalId);
      console.log("Raw _type:", _type);
      console.log("Raw _url:", _url);
      console.log("Raw _address:", _address);
      console.log("Raw _description:", _description); // <-- NEW DEBUG LOG
      console.log("Raw _proposer:", _proposer);
      console.log("Raw _creationTimestamp:", _creationTimestamp);
      console.log("Raw _votingPeriodEnd:", _votingPeriodEnd);
      console.log("-------------------------------------------------------");

      const proposalTypeMap = ['AddURL', 'AddAddress', 'RemoveURL', 'RemoveAddress'];
      const proposalType = proposalTypeMap[Number(_type)];

      await Proposal.findOneAndUpdate(
        { proposalId: Number(proposalId) },
        {
          proposalId: Number(proposalId),
          proposalType: proposalType,
          urlValue: _url,
          addressValue: _address,
          description: _description, // <--- CORRECTED: Now uses the _description parameter from the event
          creationTimestamp: toDate(_creationTimestamp),
          votingPeriodEnd: toDate(_votingPeriodEnd),
          proposer: _proposer,
          status: 'Active',
          yesVotes: 0,
          noVotes: 0,
          totalVoters: 0
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Indexer: Proposal Created - ID: ${Number(proposalId)}, Type: ${proposalType}, Description: ${_description}`); // Added description to log
    } catch (error) {
      console.error(`Indexer Error processing ProposalCreated event for ID ${Number(proposalId)}:`, error);
    }
  });


  proposalVotingContract.on('VoteCast', async (proposalId, voter, _support, _yesVotes, _noVotes, event) => {
    try {
      const pId = Number(proposalId);
      const support = _support;

      // Fetch block timestamp
      let voteTimestamp;
      if (event.log && event.log.blockNumber) {
        const block = await provider.getBlock(event.log.blockNumber);
        voteTimestamp = block ? toDate(block.timestamp) : new Date();
      } else {
        voteTimestamp = new Date();
        console.warn(`VoteCast event for Proposal ID ${pId} missing block number, using current timestamp.`);
      }

      await Vote.findOneAndUpdate(
        { proposalId: pId, voter: voter },
        {
          proposalId: pId,
          voter: voter,
          support: support,
          timestamp: voteTimestamp
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Update proposal vote counts
      await Proposal.findOneAndUpdate(
        { proposalId: pId },
        {
          yesVotes: Number(_yesVotes),
          noVotes: Number(_noVotes),
          totalVoters: Number(_yesVotes) + Number(_noVotes)
        },
        { new: true }
      );
      console.log(`Indexer: Vote Cast - Proposal ID: ${pId}, Voter: ${voter}, Support: ${support}`);
    } catch (error) {
      console.error(`Indexer Error processing VoteCast event for Proposal ID ${Number(proposalId)}:`, error);
    }
  });

  proposalVotingContract.on('ProposalStatusUpdated', async (proposalId, _oldStatus, _newStatus, event) => {
    try {
      const statusMap = ['Active', 'Approved', 'Rejected', 'Executed'];
      // CRITICAL FIX: Explicitly convert _newStatus to a Number for array access
      const newStatus = statusMap[Number(_newStatus)];

      await Proposal.findOneAndUpdate(
        { proposalId: Number(proposalId) },
        { status: newStatus },
        { new: true }
      );
      console.log(`Indexer: Proposal Status Updated - ID: ${Number(proposalId)}, New Status: ${newStatus}`);
    } catch (error) {
      console.error(`Indexer Error processing ProposalStatusUpdated event for ID ${Number(proposalId)}:`, error);
    }
  });

  proposalVotingContract.on('ProposalExecuted', async (proposalId, _type, _url, _address, executor, event) => {
    try {
      const pId = Number(proposalId);
      // No status update here, as ProposalStatusUpdated already handles the 'Executed' status
      // when executeApprovedProposal emits its own ProposalStatusUpdated event.
      // This listener is primarily for logging the ProposalExecuted event for audit purposes.

      console.log(`Indexer: Proposal Executed - ID: ${pId}, Executor: ${executor} (Action confirmed on BlacklistRegistry)`);
    } catch (error) {
      console.error(`Indexer Error processing ProposalExecuted event for ID ${pId}:`, error);
    }
  });

  // Handle errors
  provider.on('error', (error) => {
    console.error("Ethers.js Provider Error:", error);
  });
};

module.exports = startBlockchainIndexer;
module.exports.provider = provider; // Export provider for other modules (optional now)
