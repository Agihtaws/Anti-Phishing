const express = require('express');
const router = express.Router();
const { BlacklistEntry, Proposal, Vote } = require('../models'); // Import Mongoose models

/**
 * @route GET /api/proposals
 * @desc Retrieve a list of all proposals, with optional filters for status and type.
 * @queryParam status (string, optional): Filter by proposal status (Active, Approved, Rejected, Executed).
 * @queryParam type (string, optional): Filter by proposal type (AddURL, AddAddress, RemoveURL, RemoveAddress).
 * @access Public
 */
router.get('/proposals', async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.type) {
      query.proposalType = req.query.type;
    }

    const proposals = await Proposal.find(query).sort({ creationTimestamp: -1 }); // Sort by newest first
    res.status(200).json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error.message);
    res.status(500).json({ message: 'Failed to retrieve proposals', error: error.message });
  }
});

/**
 * @route GET /api/proposals/:id
 * @desc Get detailed information about a specific proposal.
 * @param id (number): The proposalId from the smart contract.
 * @access Public
 */
router.get('/proposals/:id', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.id);
    if (isNaN(proposalId) || proposalId <= 0) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const proposal = await Proposal.findOne({ proposalId: proposalId });
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }
    res.status(200).json(proposal);
  } catch (error) {
    console.error(`Error fetching proposal ID ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Failed to retrieve proposal', error: error.message });
  }
});

/**
 * @route GET /api/blacklist/urls
 * @desc Get a list of all currently active blacklisted URLs.
 * @access Public
 */
router.get('/blacklist/urls', async (req, res) => {
  try {
    const urls = await BlacklistEntry.find({ type: 'URL', isActive: true }).select('value proposer timestamp -_id'); // Only return relevant fields
    res.status(200).json(urls);
  } catch (error) {
    console.error('Error fetching blacklisted URLs:', error.message);
    res.status(500).json({ message: 'Failed to retrieve blacklisted URLs', error: error.message });
  }
});

/**
 * @route GET /api/blacklist/addresses
 * @desc Get a list of all currently active blacklisted addresses.
 * @access Public
 */
router.get('/blacklist/addresses', async (req, res) => {
  try {
    const addresses = await BlacklistEntry.find({ type: 'Address', isActive: true }).select('value proposer timestamp -_id'); // Only return relevant fields
    res.status(200).json(addresses);
  } catch (error) {
    console.error('Error fetching blacklisted addresses:', error.message);
    res.status(500).json({ message: 'Failed to retrieve blacklisted addresses', error: error.message });
  }
});

/**
 * @route GET /api/blacklist/check?url=... or /api/blacklist/check?address=...
 * @desc A quick endpoint to check if a specific URL or address is blacklisted.
 * @queryParam url (string, optional): The URL to check.
 * @queryParam address (string, optional): The Ethereum address to check.
 * @access Public
 */
router.get('/blacklist/check', async (req, res) => {
  try {
    const { url, address } = req.query;
    let entry = null;

    if (url) {
      entry = await BlacklistEntry.findOne({ type: 'URL', value: url, isActive: true });
    } else if (address) {
      entry = await BlacklistEntry.findOne({ type: 'Address', value: address, isActive: true });
    } else {
      return res.status(400).json({ message: 'Please provide either a "url" or an "address" to check.' });
    }

    if (entry) {
      res.status(200).json({ isBlacklisted: true, entry: entry });
    } else {
      res.status(200).json({ isBlacklisted: false });
    }
  } catch (error) {
    console.error('Error checking blacklist status:', error.message);
    res.status(500).json({ message: 'Failed to check blacklist status', error: error.message });
  }
});

/**
 * @route GET /api/proposals/:id/votes
 * @desc Get all individual votes for a specific proposal.
 * @param id (number): The proposalId from the smart contract.
 * @access Public
 */
router.get('/proposals/:id/votes', async (req, res) => {
  try {
    const proposalId = parseInt(req.params.id);
    if (isNaN(proposalId) || proposalId <= 0) {
      return res.status(400).json({ message: 'Invalid proposal ID' });
    }

    const votes = await Vote.find({ proposalId: proposalId }).sort({ timestamp: 1 }); // Sort by oldest first
    if (votes.length === 0) {
      // Optionally return 404 if no votes, or an empty array if that's preferred
      return res.status(200).json([]); 
    }
    res.status(200).json(votes);
  } catch (error) {
    console.error(`Error fetching votes for proposal ID ${req.params.id}:`, error.message);
    res.status(500).json({ message: 'Failed to retrieve votes', error: error.message });
  }
});

module.exports = router;
