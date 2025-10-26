import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';

// Import backend API services for IPFS upload
import { uploadEvidenceToIPFS } from '../services/backendApi';

// Import contract interaction hooks
import {
  useCreateProposal,
  useTransactionConfirmation,
  useGetTokenBalance,
  useGetProposalVotingOwner,
  useGetMinProposerTokenHoldings,
  useGetMinVotingPeriod, // NEW: Import this hook
} from '../hooks/useContractInteractions';

// Enum mapping for proposal types (must match Solidity enum order)
const ProposalTypeEnum = {
  AddURL: 0,
  AddAddress: 1,
  RemoveURL: 2,
  RemoveAddress: 3,
};

// Helper to convert duration units to seconds
const convertToSeconds = (value, unit) => {
  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue <= 0) return 0;
  switch (unit) {
    case 'minutes': return numValue * 60;
    case 'hours': return numValue * 60 * 60;
    case 'days': return numValue * 24 * 60 * 60;
    default: return 0;
  }
};

function CreateProposalPage() {
  const { address, isConnected } = useAccount();

  // --- Form States ---
  const [proposalType, setProposalType] = useState(ProposalTypeEnum.AddURL);
  const [itemValue, setItemValue] = useState('');
  const [description, setDescription] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadedCid, setUploadedCid] = useState(null);
  const [durationValue, setDurationValue] = useState('1'); // Default 1
  const [durationUnit, setDurationUnit] = useState('days'); // Default days

  // --- UI Loading/Error States ---
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [formError, setFormError] = useState(null);

  // --- Contract Interaction Hooks ---
  const createProposal = useCreateProposal();
  const [createProposalTxHash, setCreateProposalTxHash] = useState(null);
  const { isLoading: isCreatingProposal, isSuccess: isCreateProposalSuccess, error: createProposalError } = useTransactionConfirmation(createProposalTxHash);

  // Fetch necessary data for proposal creation requirements
  const { data: userAPGTBalance, isLoading: isLoadingAPGTBalance, error: APGTBalanceError } = useGetTokenBalance(address);
  const { data: proposalVotingOwner, isLoading: isLoadingOwner, error: ownerError } = useGetProposalVotingOwner();
  const { data: minProposerTokenHoldings, isLoading: isLoadingMinHoldings, error: minHoldingsError } = useGetMinProposerTokenHoldings();
  const { data: minVotingPeriodContract, isLoading: isLoadingMinVotingPeriod, error: minVotingPeriodError } = useGetMinVotingPeriod(); // NEW

  // --- Conditional Logic for UI ---
  const isCurrentUserOwner = isConnected && address && proposalVotingOwner && address.toLowerCase() === proposalVotingOwner.toLowerCase();

  const userHasSufficientAPGT = isConnected && userAPGTBalance && minProposerTokenHoldings && userAPGTBalance >= minProposerTokenHoldings;
  const missingAPGTAmount = (userAPGTBalance && minProposerTokenHoldings) ? ethers.formatUnits(minProposerTokenHoldings - userAPGTBalance, 18) : 'N/A';
  const formattedMinHoldings = minProposerTokenHoldings ? ethers.formatUnits(minProposerTokenHoldings, 18) : 'N/A';
  const formattedUserBalance = userAPGTBalance ? ethers.formatUnits(userAPGTBalance, 18) : 'N/A';

  const userChosenDurationInSeconds = convertToSeconds(durationValue, durationUnit);
  const effectiveVotingDuration = (minVotingPeriodContract && userChosenDurationInSeconds < Number(minVotingPeriodContract))
                                  ? Number(minVotingPeriodContract) // Enforce contract minimum
                                  : userChosenDurationInSeconds;

  const formattedMinVotingPeriod = minVotingPeriodContract ? `${Number(minVotingPeriodContract) / 3600} hours` : 'Loading...';


  const canSubmitCurrentProposal = () => {
    if (!isConnected || !address) return false;
    if (!itemValue.trim() || !description.trim()) return false;
    if (userChosenDurationInSeconds <= 0) return false; // Duration must be positive

    if (proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.AddAddress) {
      return userHasSufficientAPGT;
    } else if (proposalType === ProposalTypeEnum.RemoveURL || proposalType === ProposalTypeEnum.RemoveAddress) {
      return isCurrentUserOwner;
    }
    return false;
  };

  const isAnyLoading = isLoadingAPGTBalance || isLoadingOwner || isLoadingMinHoldings || isLoadingMinVotingPeriod || isCreatingProposal || isUploading;
  const anyError = APGTBalanceError || ownerError || minHoldingsError || minVotingPeriodError || uploadError || formError || createProposalError;


  // --- Handlers ---

  const handleFileUpload = async () => {
    if (!uploadFile) {
      setUploadError("Please select a file to upload as evidence.");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await uploadEvidenceToIPFS(uploadFile);
      setUploadedCid(result.cid);
      setUploadFile(null);
      alert(`File uploaded to IPFS! CID: ${result.cid}`);
    } catch (err) {
      console.error("Error uploading evidence:", err);
      setUploadError(err.message || "Failed to upload file to IPFS.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!isConnected || !address) {
      setFormError("Please connect your wallet to submit a proposal.");
      return;
    }
    if (!itemValue.trim()) {
      setFormError("URL/Address cannot be empty.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description cannot be empty.");
      return;
    }
    if (userChosenDurationInSeconds <= 0) {
      setFormError("Please select a valid voting duration.");
      return;
    }


    // Enforce on-chain rules locally before sending transaction
    if (proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.AddAddress) {
      if (!userHasSufficientAPGT) {
        setFormError(`Insufficient APGT to create an 'Add' proposal. You need ${formattedMinHoldings} APGT.`);
        return;
      }
    } else if (proposalType === ProposalTypeEnum.RemoveURL || proposalType === ProposalTypeEnum.RemoveAddress) {
      if (!isCurrentUserOwner) {
        setFormError("Only the contract owner can create 'Remove' proposals.");
        return;
      }
    }

    let finalDescription = description;
    if (uploadedCid) {
      finalDescription = `${description} (IPFS Evidence: ${uploadedCid})`;
    }

    try {
      let urlArg = '';
      let addressArg = ethers.ZeroAddress;

      if (proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.RemoveURL) {
        urlArg = itemValue;
      } else if (proposalType === ProposalTypeEnum.AddAddress || proposalType === ProposalTypeEnum.RemoveAddress) {
        addressArg = itemValue;
      }

      // Pass the effectiveVotingDuration to the smart contract
      const hash = await createProposal(proposalType, urlArg, addressArg, finalDescription, BigInt(effectiveVotingDuration)); // NEW ARGUMENT
      setCreateProposalTxHash(hash);
      alert("Proposal transaction sent! Awaiting confirmation.");

      // Reset form fields after successful submission attempt
      setProposalType(ProposalTypeEnum.AddURL);
      setItemValue('');
      setDescription('');
      setUploadFile(null); // Clear file input
      setUploadedCid(null);
      setDurationValue('1');
      setDurationUnit('days');

    } catch (err) {
      console.error("Error submitting proposal:", err);
      setFormError(createProposalError || err.message || "Failed to submit proposal.");
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Header */}
        <h1 className="text-center glow">Create New Proposal</h1>

        {/* Connect Button */}
        <div className="text-right">
          <ConnectButton />
        </div>

        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Link to="/" className="btn-back-link" style={{ alignSelf: 'flex-start' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414L7.828 11z"/></svg>
              Back to Proposals
            </Link>

            <form onSubmit={handleSubmitProposal} className="card">
              <h2 className="new-proposal-heading">📝 Proposal Details</h2>

              {/* General Alerts */}
              {formError && (
                <div className="alert alert-error mb-2">
                  ❌ {formError}
                </div>
              )}
              {anyError && !formError && (
                 <div className="alert alert-error mb-2">
                   ❌ {anyError}
                 </div>
              )}
              {isCreateProposalSuccess && (
                <div className="alert alert-success mb-2">
                  ✅ Proposal created successfully! Tx Hash: <a href={`https://sepolia.basescan.org/tx/${createProposalTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan-primary)' }}>{createProposalTxHash.substring(0, 10)}...</a>
                </div>
              )}

              {/* Loading State for initial data fetches */}
              {(isLoadingAPGTBalance || isLoadingOwner || isLoadingMinHoldings || isLoadingMinVotingPeriod) && (
                <div className="spinner mt-2"></div>
              )}

              {/* Proposal Type Specific Requirements */}
              {(proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.AddAddress) && (
                <div className="alert alert-info mb-2">
                  ℹ️ To create an **'Add' proposal**, you need at least <strong style={{color: 'var(--cyan-light)'}}>{formattedMinHoldings} APGT</strong>. Your current balance is <strong style={{color: 'var(--cyan-light)'}}>{formattedUserBalance} APGT</strong>.
                  {!userHasSufficientAPGT && (
                    <p className="text-danger mt-1">
                      You need {missingAPGTAmount} more APGT.
                    </p>
                  )}
                </div>
              )}

              {(proposalType === ProposalTypeEnum.RemoveURL || proposalType === ProposalTypeEnum.RemoveAddress) && (
                <div className="alert alert-warning mb-2">
                  ⚠️ **'Remove' proposals** can only be created by the **contract owner**.<br/>
                  Owner: <strong style={{color: 'var(--yellow-warning)'}}>{proposalVotingOwner ? `${proposalVotingOwner.substring(0, 6)}...${proposalVotingOwner.substring(proposalVotingOwner.length - 4)}` : 'Loading...'}</strong><br/>
                  You are: <strong style={{color: isCurrentUserOwner ? 'var(--green-success)' : 'var(--red-danger)'}}>{isCurrentUserOwner ? 'The Owner' : 'Not the Owner'}</strong>
                </div>
              )}


              <div className="form-group">
                <label htmlFor="proposalType">Proposal Type:</label>
                <select
                  id="proposalType"
                  value={proposalType}
                  onChange={(e) => setProposalType(parseInt(e.target.value))}
                  className="input"
                  disabled={isAnyLoading}
                >
                  <option value={ProposalTypeEnum.AddURL}>Add URL to Blacklist</option>
                  <option value={ProposalTypeEnum.AddAddress}>Add Address to Blacklist</option>
                  <option
                    value={ProposalTypeEnum.RemoveURL}
                    disabled={!isCurrentUserOwner}
                  >
                    Remove URL from Blacklist
                  </option>
                  <option
                    value={ProposalTypeEnum.RemoveAddress}
                    disabled={!isCurrentUserOwner}
                  >
                    Remove Address from Blacklist
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="itemValue">
                  {proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.RemoveURL ? 'URL:' : 'Address:'}
                </label>
                <input
                  id="itemValue"
                  type="text"
                  placeholder={
                    proposalType === ProposalTypeEnum.AddURL || proposalType === ProposalTypeEnum.RemoveURL
                      ? "e.g., https://malicious-site.com"
                      : "e.g., 0xdeadbeef..."
                  }
                  value={itemValue}
                  onChange={(e) => setItemValue(e.target.value)}
                  className="input"
                  disabled={isAnyLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (Reason for proposal):</label>
                <textarea
                  id="description"
                  placeholder="Provide a clear reason for this proposal, including any relevant details or evidence."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input"
                  rows="4"
                  disabled={isAnyLoading}
                ></textarea>
              </div>

              {/* NEW: Voting Duration Input */}
              <div className="form-group">
                <label htmlFor="votingDuration">Voting Duration:</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="durationValue"
                    type="number"
                    min="1"
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                    disabled={isAnyLoading}
                  />
                  <select
                    id="durationUnit"
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                    disabled={isAnyLoading}
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                {minVotingPeriodContract && userChosenDurationInSeconds < Number(minVotingPeriodContract) && (
                  <p className="text-warning mt-1">
                    ⚠️ Your chosen duration is less than the contract's minimum ({Number(minVotingPeriodContract) / 3600} hours). The minimum will be applied.
                  </p>
                )}
                {minVotingPeriodContract && (
                  <p className="text-muted mt-1">
                    Contract Minimum: {Number(minVotingPeriodContract) / 3600} hours
                  </p>
                )}
              </div>

              {/* File Upload for Evidence */}
              <div className="card ipfs-upload-section">
                <h3>📎 Upload Evidence (Optional)</h3>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  disabled={isAnyLoading}
                />
                <button
                  type="button"
                  onClick={handleFileUpload}
                  className="btn btn-secondary upload-btn"
                  disabled={isUploading || !uploadFile || isAnyLoading}
                >
                  {isUploading ? 'Uploading...' : 'Upload to IPFS'}
                </button>
                {uploadError && (
                  <div className="alert alert-error mt-2">
                    ❌ Upload failed: {uploadError}
                  </div>
                )}
                {uploadedCid && (
                  <div className="alert alert-info mt-2">
                    ✅ Uploaded CID: <a href={`https://gateway.pinata.cloud/ipfs/${uploadedCid}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan-primary)' }}>{uploadedCid}</a>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAnyLoading || !isConnected || !canSubmitCurrentProposal()}
              >
                {isCreatingProposal ? 'Submitting...' : 'Submit Proposal'}
              </button>

            </form>

          </div>
        ) : (
          <div className="card text-center">
            <h2>👻 Connect your wallet to submit a proposal</h2>
            <p className="text-muted">Click the "Connect Wallet" button above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateProposalPage;
