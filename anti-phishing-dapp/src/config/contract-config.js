import BlacklistRegistryABI from './BlacklistRegistry.json';
import ProposalVotingABI from './ProposalVoting.json';
import GovernanceTokenABI from '././GovernanceToken.json';

// Ensure environment variables are loaded
const BLACKLIST_REGISTRY_ADDRESS = import.meta.env.VITE_BLACKLIST_REGISTRY_ADDRESS;
const PROPOSAL_VOTING_ADDRESS = import.meta.env.VITE_PROPOSAL_VOTING_ADDRESS;
const GOVERNANCE_TOKEN_ADDRESS = import.meta.env.VITE_GOVERNANCE_TOKEN_ADDRESS;

export const CONTRACT_CONFIG = {
  blacklistRegistry: {
    address: BLACKLIST_REGISTRY_ADDRESS,
    abi: BlacklistRegistryABI.abi, // Access the 'abi' property from the imported JSON
  },
  proposalVoting: {
    address: PROPOSAL_VOTING_ADDRESS,
    abi: ProposalVotingABI.abi, // Access the 'abi' property
  },
  governanceToken: {
    address: GOVERNANCE_TOKEN_ADDRESS,
    abi: GovernanceTokenABI.abi, // Access the 'abi' property
  },
};

export const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
export const BASE_SEPOLIA_CHAIN_ID = parseInt(import.meta.env.VITE_BASE_SEPOLIA_CHAIN_ID);
export const BASE_SEPOLIA_RPC_URL = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL;
