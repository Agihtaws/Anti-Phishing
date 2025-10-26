import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_CONFIG } from '../config/contract-config';
import { parseEther } from 'ethers'; // Keep if parseEther is used elsewhere, removed from createProposal args now

// --- BlacklistRegistry Hooks ---
export const useIsURLBlacklisted = (url) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'isURLBlacklisted',
    args: [url],
    query: {
      enabled: !!url,
      staleTime: 5000,
    },
  });
};

export const useIsAddressBlacklisted = (address) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'isAddressBlacklisted',
    args: [address],
    query: {
      enabled: !!address,
      staleTime: 5000,
    },
  });
};

export const useGetURLDetails = (url) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'getURLDetails',
    args: [url],
    query: {
      enabled: !!url,
      staleTime: 5000,
    },
  });
};

export const useGetAddressDetails = (address) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'getAddressDetails',
    args: [address],
    query: {
      enabled: !!address,
      staleTime: 5000,
    },
  });
};

export const useBatchCheckURLs = (urls) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'batchCheckURLs',
    args: [urls],
    query: {
      enabled: Array.isArray(urls) && urls.length > 0,
      staleTime: 5000,
    },
  });
};

export const useBatchCheckAddresses = (addresses) => {
  return useReadContract({
    address: CONTRACT_CONFIG.blacklistRegistry.address,
    abi: CONTRACT_CONFIG.blacklistRegistry.abi,
    functionName: 'batchCheckAddresses',
    args: [addresses],
    query: {
      enabled: Array.isArray(addresses) && addresses.length > 0,
      staleTime: 5000,
    },
  });
};

// --- ProposalVoting Hooks ---

export const useCreateProposal = () => {
  const { writeContractAsync } = useWriteContract();

  // The createProposal function now expects an additional argument for duration
  const createProposal = async (type, url, address, description, userDefinedVotingDurationInSeconds) => {
    const addressValue = address || '0x0000000000000000000000000000000000000000';
    const urlValue = url || '';

    return writeContractAsync({
      address: CONTRACT_CONFIG.proposalVoting.address,
      abi: CONTRACT_CONFIG.proposalVoting.abi,
      functionName: 'createProposal',
      args: [type, urlValue, addressValue, description, userDefinedVotingDurationInSeconds], // NEW ARGUMENT
    });
  };

  return createProposal;
};

export const useVote = () => {
  const { writeContractAsync } = useWriteContract();

  const vote = async (proposalId, support) => {
    return writeContractAsync({
      address: CONTRACT_CONFIG.proposalVoting.address,
      abi: CONTRACT_CONFIG.proposalVoting.abi,
      functionName: 'vote',
      args: [BigInt(proposalId), support],
    });
  };

  return vote;
};

// This hook is now used to end the voting period and set status to Approved/Rejected
export const useEndVotingPeriod = () => { // <--- RENAMED HOOK for clarity
  const { writeContractAsync } = useWriteContract();

  const endVotingPeriod = async (proposalId) => { // <--- RENAMED FUNCTION for clarity
    return writeContractAsync({
      address: CONTRACT_CONFIG.proposalVoting.address,
      abi: CONTRACT_CONFIG.proposalVoting.abi,
      functionName: 'endProposalAndExecute', // <--- This calls the modified contract function
      args: [BigInt(proposalId)],
    });
  };

  return endVotingPeriod;
};

// NEW HOOK: To execute an Approved proposal
export const useExecuteApprovedProposal = () => { // <--- NEW HOOK
  const { writeContractAsync } = useWriteContract();

  const executeApprovedProposal = async (proposalId) => {
    return writeContractAsync({
      address: CONTRACT_CONFIG.proposalVoting.address,
      abi: CONTRACT_CONFIG.proposalVoting.abi,
      functionName: 'executeApprovedProposal', // <--- This calls the new contract function
      args: [BigInt(proposalId)],
    });
  };

  return executeApprovedProposal;
};

export const useGetProposal = (proposalId) => {
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'getProposal',
    args: [BigInt(proposalId)],
    query: {
      enabled: !!proposalId,
      staleTime: 5000,
    },
  });
};

export const useGetVotingResults = (proposalId) => {
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'getVotingResults',
    args: [BigInt(proposalId)],
    query: {
      enabled: !!proposalId,
      staleTime: 5000,
    },
  });
};

export const useGetProposalVotingOwner = () => {
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'owner',
    query: {
      staleTime: Infinity,
    },
  });
};

export const useGetMinProposerTokenHoldings = () => {
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'minProposerTokenHoldings',
    query: {
      staleTime: Infinity,
    },
  });
};

export const useGetMinVotingPeriod = () => {
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'minVotingPeriod',
    query: {
      staleTime: Infinity, // This value typically doesn't change often
    },
  });
};

// NEW HOOK: To get proposals that are ready for resolution (Approved/Rejected)
export const useGetProposalsReadyToResolve = () => { // <--- NEW HOOK
  return useReadContract({
    address: CONTRACT_CONFIG.proposalVoting.address,
    abi: CONTRACT_CONFIG.proposalVoting.abi,
    functionName: 'getProposalsReadyToResolve', // <--- NEW FUNCTION NAME
    query: {
      staleTime: 5000,
    },
  });
};


// --- GovernanceToken Hooks ---
export const useGetTokenBalance = (address) => {
  return useReadContract({
    address: CONTRACT_CONFIG.governanceToken.address,
    abi: CONTRACT_CONFIG.governanceToken.abi,
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: !!address,
      staleTime: 5000,
    },
  });
};

export const useDelegateVotes = () => {
  const { writeContractAsync } = useWriteContract();

  const delegateVotes = async (delegateeAddress) => {
    return writeContractAsync({
      address: CONTRACT_CONFIG.governanceToken.address,
      abi: CONTRACT_CONFIG.governanceToken.abi,
      functionName: 'delegate',
      args: [delegateeAddress],
    });
  };

  return delegateVotes;
};

export const useTransactionConfirmation = (hash) => {
  const { data, isLoading, isSuccess, error } = useWaitForTransactionReceipt({
    hash: hash,
    query: {
      enabled: !!hash,
    },
  });

  let userFriendlyError = null;
  if (error) {
    if (error.message.includes('User rejected the request')) {
      userFriendlyError = 'Transaction rejected by user.';
    } else if (error.message.includes('insufficient funds')) {
      userFriendlyError = 'Insufficient funds for transaction.';
    } else if (error.message.includes('Transaction reverted')) {
      userFriendlyError = 'Transaction reverted on-chain. Check contract logic or inputs.';
    } else {
      userFriendlyError = error.shortMessage || error.message;
    }
    console.error("Transaction confirmation error details:", error);
  }

  return { data, isLoading, isSuccess, error: userFriendlyError };
};
