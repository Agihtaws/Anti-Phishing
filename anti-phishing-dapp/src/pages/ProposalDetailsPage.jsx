import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

// Import backend API services
import { fetchProposalDetails, fetchProposalVotes } from '../services/backendApi';

// Import contract interaction hooks
import {
  useGetProposal,
  useVote,
  useEndVotingPeriod, // <--- CHANGED: Import the new hook for ending voting
  useExecuteApprovedProposal, // <--- NEW: Import the hook for executing approved proposals
  useTransactionConfirmation,
  useGetProposalVotingOwner,
} from '../hooks/useContractInteractions';

function ProposalDetailsPage() {
  const { id } = useParams();
  const proposalId = parseInt(id);
  const { address, isConnected } = useAccount();

  const [proposal, setProposal] = useState(null);
  const [votes, setVotes] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // --- Contract Interaction Hooks ---
  const { data: onChainProposalDetails, isLoading: isLoadingOnChainDetails, error: onChainDetailsError } = useGetProposal(proposalId);
  const vote = useVote();
  const endVotingPeriod = useEndVotingPeriod(); // <--- CHANGED: Use the new hook
  const executeApprovedProposal = useExecuteApprovedProposal(); // <--- NEW: Use the new hook

  const [voteTxHash, setVoteTxHash] = useState(null);
  const { isLoading: isVoting, isSuccess: isVoteSuccess, error: voteError } = useTransactionConfirmation(voteTxHash);

  // Separate transaction hashes for ending voting vs. executing
  const [resolveTxHash, setResolveTxHash] = useState(null); // For ending voting period (setting Approved/Rejected)
  const { isLoading: isResolving, isSuccess: isResolveSuccess, error: resolveError } = useTransactionConfirmation(resolveTxHash);

  const [executeTxHash, setExecuteTxHash] = useState(null); // For final execution of an Approved proposal
  const { isLoading: isExecuting, isSuccess: isExecuteSuccess, error: executeError } = useTransactionConfirmation(executeTxHash);

  const { data: proposalVotingOwner, isLoading: isLoadingProposalVotingOwner, error: proposalVotingOwnerError } = useGetProposalVotingOwner();

  const isCurrentUserOwner = isConnected && address && proposalVotingOwner && address.toLowerCase() === proposalVotingOwner.toLowerCase();


  // --- Fetch Proposal Details and Votes from Backend ---
  const loadProposalData = async () => {
    setIsLoadingData(true);
    setPageError(null);
    try {
      const fetchedProposal = await fetchProposalDetails(proposalId);
      if (!fetchedProposal) {
        setPageError("Proposal not found.");
        return;
      }
      setProposal(fetchedProposal);

      const fetchedVotes = await fetchProposalVotes(proposalId);
      setVotes(fetchedVotes);

    } catch (err) {
      console.error("Error loading proposal data:", err);
      setPageError(err.message || "Failed to load proposal details.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (proposalId && !isNaN(proposalId)) {
      loadProposalData();
    } else {
      setPageError("Invalid Proposal ID in URL.");
      setIsLoadingData(false);
    }
  }, [proposalId, isVoteSuccess, isResolveSuccess, isExecuteSuccess, lastRefreshed]); // <--- UPDATED dependencies

  // --- Handlers for Voting and Execution ---
  const handleVote = async (support) => {
    if (!isConnected || !address) {
      alert("Please connect your wallet to vote.");
      return;
    }
    try {
      const hash = await vote(proposalId, support);
      setVoteTxHash(hash);
      console.log("Vote transaction sent:", hash);
    } catch (err) {
      console.error("Error casting vote:", err);
      setPageError(err.message || "Failed to cast vote.");
    }
  };

  // NEW: Handler for ending the voting period (sets status to Approved/Rejected)
  const handleEndVotingPeriod = async () => { // <--- NEW HANDLER
    if (!isConnected || !address) {
      alert("Please connect your wallet to finalize voting.");
      return;
    }
    try {
      const hash = await endVotingPeriod(proposalId);
      setResolveTxHash(hash);
      console.log("End voting period transaction sent:", hash);
    } catch (err) {
      console.error("Error ending voting period:", err);
      setPageError(err.message || "Failed to finalize voting period.");
    }
  };

  // NEW: Handler for executing an Approved proposal (owner only)
  const handleExecuteApprovedProposal = async () => { // <--- NEW HANDLER
    if (!isConnected || !address) {
      alert("Please connect your wallet to execute.");
      return;
    }
    if (!isCurrentUserOwner) {
      alert("Only the owner of the ProposalVoting contract can execute approved proposals.");
      return;
    }
    try {
      const hash = await executeApprovedProposal(proposalId);
      setExecuteTxHash(hash);
      console.log("Execute approved proposal transaction sent:", hash);
    } catch (err) {
      console.error("Error executing approved proposal:", err);
      setPageError(err.message || "Failed to execute approved proposal.");
    }
  };

  // --- Extract IPFS CID from description (simple heuristic) ---
  const getIpfsCidFromDescription = (description) => {
    if (!description) return null;
    const cidRegex = /(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-zA-Z0-9]{50,})/;
    const match = description.match(cidRegex);
    return match ? match[0] : null;
  };

  const ipfsCid = proposal ? getIpfsCidFromDescription(proposal.description) : null;
  const ipfsGatewayUrl = ipfsCid ? `https://gateway.pinata.cloud/ipfs/${ipfsCid}` : null;
  const isImageCid = ipfsGatewayUrl && /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(ipfsGatewayUrl);


  if (isLoadingData || isLoadingProposalVotingOwner) {
    return (
      <div className="container text-center">
        <div className="spinner"></div>
        <p className="text-muted">Loading proposal details...</p>
      </div>
    );
  }

  if (pageError || proposalVotingOwnerError) {
    return (
      <div className="container">
        <div className="alert alert-error">
          ❌ {pageError || proposalVotingOwnerError.message} <Link to="/" style={{ color: 'var(--cyan-light)' }}>Go back to proposals</Link>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          ⚠️ Proposal data could not be loaded. <Link to="/" style={{ color: 'var(--cyan-light)' }}>Go back to proposals</Link>
        </div>
      </div>
    );
  }

  // --- Determine UI states based on proposal status and time ---
  const now = new Date();
  const votingPeriodHasEnded = new Date(proposal.votingPeriodEnd) <= now;
  const isProposalActive = proposal.status === 'Active';
  const isProposalApproved = proposal.status === 'Approved';
  const isProposalRejected = proposal.status === 'Rejected';
  const isProposalExecuted = proposal.status === 'Executed';

  // Can end voting period if active and time has ended
  const canEndVotingPeriod = isProposalActive && votingPeriodHasEnded;

  // Can execute if approved and current user is owner
  const canExecuteApproved = isProposalApproved && isCurrentUserOwner;


  return (
    <div className="container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <h1 className="text-center glow">Proposal #{proposal.proposalId} Details</h1>
        <div className="text-right">
          <ConnectButton />
        </div>

        {isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Link to="/" className="btn-back-link" style={{ alignSelf: 'flex-start' }}>← Back to All Proposals</Link>

            <div className="card">
              <h2>📋 Proposal Overview</h2>
              <p><strong>ID:</strong> {proposal.proposalId}</p>
              <p><strong>Type:</strong> <span className="badge">{proposal.proposalType}</span></p>
              <p><strong>Item:</strong> {proposal.urlValue || proposal.addressValue}</p>
              <p><strong>Status:</strong> <span className="badge" style={{
                background: isProposalActive ? 'var(--blue-primary)' :
                            isProposalApproved ? 'var(--green-success)' : // New: Approved status color
                            isProposalExecuted ? 'var(--green-success)' :
                            'var(--red-danger)' // For Rejected
              }}>{proposal.status}</span></p>
              <p><strong>Proposer:</strong> {proposal.proposer}</p>
              <p><strong>Created:</strong> {new Date(proposal.creationTimestamp).toLocaleString()}</p>
              <p><strong>Voting Ends:</strong> {new Date(proposal.votingPeriodEnd).toLocaleString()}</p>
              <p><strong>Description:</strong> {proposal.description}</p>

              {ipfsCid && (
                <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                  📎 Evidence: 
                  {isImageCid ? (
                    <div style={{ marginTop: '10px' }}>
                      <img src={ipfsGatewayUrl} alt="Evidence" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
                      <p style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                        <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan-primary)', wordBreak: 'break-all' }}>
                          View Full Image on IPFS Gateway
                        </a>
                      </p>
                    </div>
                  ) : (
                    <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan-primary)', wordBreak: 'break-all' }}>
                      View IPFS CID: {ipfsCid}
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h2>🗳️ Vote on this Proposal</h2>
              {isProposalActive && !votingPeriodHasEnded ? (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => handleVote(true)}
                    className="btn btn-success"
                    disabled={isVoting}
                    style={{ flex: 1 }}
                  >
                    {isVoting ? 'Voting...' : '✅ Vote YES'}
                  </button>
                  <button
                    onClick={() => handleVote(false)}
                    className="btn btn-danger"
                    disabled={isVoting}
                    style={{ flex: 1 }}
                  >
                    {isVoting ? 'Voting...' : '❌ Vote NO'}
                  </button>
                </div>
              ) : (
                <p className="text-muted">Voting is no longer active for this proposal.</p>
              )}
              {isVoteSuccess && (
                <div className="alert alert-success mt-2">
                  ✅ Vote cast successfully! Tx: {voteTxHash}
                </div>
              )}
              {voteError && (
                <div className="alert alert-error mt-2">
                  ❌ Voting failed: {voteError.message}
                </div>
              )}
            </div>

            <div className="card">
              <h2>📊 Current Voting Results</h2>
              <p><strong>Yes Votes:</strong> {proposal.yesVotes}</p>
              <p><strong>No Votes:</strong> {proposal.noVotes}</p>
              <p><strong>Total Voters:</strong> {proposal.totalVoters}</p>
              {proposal.totalVoters > 0 && (
                <p><strong>Approval:</strong> {((proposal.yesVotes / proposal.totalVoters) * 100).toFixed(2)}%</p>
              )}
            </div>

            <div className="card">
              <h2>⚡ Resolve & Execute Proposal</h2>
              {isProposalExecuted ? (
                <p className="text-success text-bold">This proposal has already been executed.</p>
              ) : isProposalRejected ? (
                <p className="text-danger text-bold">This proposal has been rejected by the community.</p>
              ) : (
                <>
                  {/* Button to end voting period (sets status to Approved/Rejected) */}
                  {canEndVotingPeriod && (
                    <button
                      onClick={handleEndVotingPeriod}
                      className="btn btn-secondary"
                      disabled={isResolving}
                    >
                      {isResolving ? 'Finalizing Votes...' : 'Finalize Voting Outcome'}
                    </button>
                  )}
                  {!canEndVotingPeriod && isProposalActive && !votingPeriodHasEnded && (
                    <p className="text-muted mt-2">Voting is still active. Please wait until {new Date(proposal.votingPeriodEnd).toLocaleString()}.</p>
                  )}
                  {isResolveSuccess && (
                    <div className="alert alert-success mt-2">
                      ✅ Voting outcome finalized! Status: {proposal.status}. Tx: {resolveTxHash}
                    </div>
                  )}
                  {resolveError && (
                    <div className="alert alert-error mt-2">
                      ❌ Finalizing failed: {resolveError.message}
                    </div>
                  )}

                  {/* Button to execute APPROVED proposal (owner only) */}
                  {isProposalApproved && (
                    <button
                      onClick={handleExecuteApprovedProposal}
                      className="btn btn-primary mt-3" // Added margin-top for spacing
                      disabled={!canExecuteApproved || isExecuting}
                    >
                      {isExecuting ? 'Executing...' : 'Execute Approved Proposal'}
                    </button>
                  )}
                  {isProposalApproved && !isCurrentUserOwner && isConnected && (
                    <p className="text-muted mt-2">Only the contract owner ({proposalVotingOwner ? `${proposalVotingOwner.substring(0, 6)}...${proposalVotingOwner.substring(proposalVotingOwner.length - 4)}` : 'Loading...'}) can execute approved proposals.</p>
                  )}
                  {isExecuteSuccess && (
                    <div className="alert alert-success mt-2">
                      ✅ Proposal executed! Tx: {executeTxHash}
                    </div>
                  )}
                  {executeError && (
                    <div className="alert alert-error mt-2">
                      ❌ Execution failed: {executeError.message}
                    </div>
                  )}
                </>
              )}
              <button onClick={() => setLastRefreshed(Date.now())} className="btn-outline" style={{ marginTop: '1rem' }}>
                Refresh Data
              </button>
            </div>

            <div className="card">
              <h2>📜 All Votes</h2>
              {votes.length === 0 ? (
                <p className="text-muted">No votes recorded yet.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {votes.map((voteEntry, index) => (
                    <li key={index} style={{ marginBottom: '0.5rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>
                      <p><strong>Voter:</strong> {voteEntry.voter}</p>
                      <p><strong>Decision:</strong> <span className="badge" style={{ background: voteEntry.support ? 'var(--green-success)' : 'var(--red-danger)' }}>{voteEntry.support ? 'YES' : 'NO'}</span></p>
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>{new Date(voteEntry.timestamp).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        ) : (
          <div className="card text-center">
            <h2>👻 Connect your wallet to interact with the system</h2>
            <p className="text-muted">Click the "Connect Wallet" button above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProposalDetailsPage;
