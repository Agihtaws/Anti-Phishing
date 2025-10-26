import axios from 'axios';
import { BACKEND_API_URL } from '../config/contract-config'; // Import the backend URL

// Create an Axios instance with a base URL
const api = axios.create({
  baseURL: BACKEND_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Read Endpoints ---

/**
 * @dev Fetches a list of proposals from the backend.
 * @param {object} filters Optional filters (e.g., { status: 'Active', type: 'AddURL' }).
 * @returns {Promise<Array>} An array of proposal objects.
 */
export const fetchProposals = async (filters = {}) => {
  try {
    const response = await api.get('/proposals', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error fetching proposals:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Fetches detailed information about a specific proposal.
 * @param {number} proposalId The ID of the proposal.
 * @returns {Promise<object>} The proposal object.
 */
export const fetchProposalDetails = async (proposalId) => {
  try {
    const response = await api.get(`/proposals/${proposalId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching proposal details for ID ${proposalId}:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Fetches a list of all currently active blacklisted URLs.
 * @returns {Promise<Array>} An array of blacklisted URL objects.
 */
export const fetchBlacklistedURLs = async () => {
  try {
    const response = await api.get('/blacklist/urls');
    return response.data;
  } catch (error) {
    console.error('Error fetching blacklisted URLs:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Fetches a list of all currently active blacklisted addresses.
 * @returns {Promise<Array>} An array of blacklisted address objects.
 */
export const fetchBlacklistedAddresses = async () => {
  try {
    const response = await api.get('/blacklist/addresses');
    return response.data;
  } catch (error) {
    console.error('Error fetching blacklisted addresses:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Checks if a specific URL or address is blacklisted.
 * @param {string} url The URL to check.
 * @param {string} address The Ethereum address to check.
 * @returns {Promise<object>} An object with `isBlacklisted` boolean and optionally `entry` data.
 */
export const checkBlacklistStatus = async ({ url, address }) => {
  try {
    const params = {};
    if (url) params.url = url;
    if (address) params.address = address;

    const response = await api.get('/blacklist/check', { params });
    return response.data;
  } catch (error) {
    console.error('Error checking blacklist status:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Fetches all individual votes for a specific proposal.
 * @param {number} proposalId The ID of the proposal.
 * @returns {Promise<Array>} An array of vote objects.
 */
export const fetchProposalVotes = async (proposalId) => {
  try {
    const response = await api.get(`/proposals/${proposalId}/votes`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching votes for proposal ID ${proposalId}:`, error.response?.data || error.message);
    throw error;
  }
};

// --- Write Endpoints (Off-chain actions) ---

/**
 * @dev Uploads a file (evidence) to IPFS via the backend's Pinata integration.
 * @param {File} file The file object to upload.
 * @returns {Promise<object>} An object containing the IPFS CID and gateway URL.
 */
export const uploadEvidenceToIPFS = async (file) => {
  try {
    const formData = new FormData();
    formData.append('evidence', file); // 'evidence' must match the field name in multer setup on backend

    const response = await api.post('/ipfs/upload-evidence', formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Important for file uploads
      },
      maxBodyLength: Infinity, // Allow large files
      maxContentLength: Infinity, // Allow large files
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading evidence to IPFS:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * @dev Claims APGT tokens from the faucet.
 * @param {string} userAddress The address to send APGT tokens to.
 * @returns {Promise<object>} An object with transaction hash and claimed amount.
 */
export const claimFaucetTokens = async (userAddress) => {
  try {
    const response = await api.post('/faucet/claim', { userAddress });
    return response.data;
  } catch (error) {
    console.error('Error claiming faucet tokens:', error.response?.data || error.message);
    throw error;
  }
};
