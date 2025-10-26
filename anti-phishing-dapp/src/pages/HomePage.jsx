import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers'; // For ethers.formatUnits
import { Link, useNavigate } from 'react-router-dom'; // <--- UPDATED: Import useNavigate

// Import backend API services
import { fetchProposals } from '../services/backendApi';

// Import contract interaction hooks
import {
  useGetTokenBalance,
  useDelegateVotes,
  useTransactionConfirmation,
  useGetMinProposerTokenHoldings,
  useGetProposalVotingOwner,
} from '../hooks/useContractInteractions';

function HomePage() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate(); // <--- NEW: Initialize useNavigate

  // --- Redirect if not connected ---
  useEffect(() => {
    if (!isConnected) {
      navigate('/'); // Redirect to the landing page if wallet is disconnected
    }
  }, [isConnected, navigate]); // Re-run effect when connection status changes

  // --- State for Proposals Dashboard ---
  const [proposals, setProposals] = useState([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);
  const [proposalsError, setProposalsError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // --- States for other general UI elements ---
  const [delegateeAddress, setDelegateeAddress] = useState('');

  // --- Contract Interaction Hooks ---
  const { data: tokenBalance, isLoading: isLoadingTokenBalance, error: tokenBalanceError } = useGetTokenBalance(address);
  const delegateVotes = useDelegateVotes();
  const [delegateTxHash, setDelegateTxHash] = useState(null);
  const { isLoading: isDelegating, isSuccess: isDelegateSuccess, error: delegateError } = useTransactionConfirmation(delegateTxHash);

  // Fetch min proposer token holdings and owner for display
  const { data: minProposerTokenHoldings, isLoading: isLoadingMinHoldings, error: minHoldingsError } = useGetMinProposerTokenHoldings();
  const { data: proposalVotingOwner, isLoading: isLoadingOwner, error: ownerError } = useGetProposalVotingOwner();

  const formattedMinHoldings = minProposerTokenHoldings ? ethers.formatUnits(minProposerTokenHoldings, 18) : 'Loading...';
  const formattedOwnerAddress = proposalVotingOwner ? `${proposalVotingOwner.substring(0, 6)}...${proposalVotingOwner.substring(proposalVotingOwner.length - 4)}` : 'Loading...';


  // --- Function to fetch proposals from backend ---
  const loadProposals = async () => {
    setIsLoadingProposals(true);
    setProposalsError(null);
    try {
      const filters = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterType) filters.type = filterType;

      let fetched = await fetchProposals(filters);

      // Apply sorting
      if (sortBy === 'newest') {
        fetched.sort((a, b) => new Date(b.creationTimestamp) - new Date(a.creationTimestamp));
      } else if (sortBy === 'oldest') {
        fetched.sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp));
      } else if (sortBy === 'mostVotes') {
        fetched.sort((a, b) => (b.yesVotes + b.noVotes) - (a.yesVotes + a.noVotes));
      }

      setProposals(fetched);
    } catch (err) {
      console.error("Error loading proposals from backend:", err);
      setProposalsError("Failed to load proposals.");
    } finally {
      setIsLoadingProposals(false);
    }
  };

  // --- Effect to load proposals on component mount and filter/sort changes ---
  useEffect(() => {
    // Only load proposals if connected, otherwise the redirect will handle it
    if (isConnected) {
      loadProposals();
    } else {
      setProposals([]);
    }
  }, [filterStatus, filterType, sortBy, isConnected]);

  // --- Handlers for direct on-chain actions ---
  const handleDelegate = async () => {
    try {
      const hash = await delegateVotes(delegateeAddress);
      setDelegateTxHash(hash);
      console.log("Delegate votes transaction sent:", hash);
    } catch (err) {
      console.error("Error delegating votes:", err);
    }
  };

  // If not connected, the redirect useEffect will handle navigation, so we render nothing here
  if (!isConnected) {
    return null; // Or a loading spinner, as the redirect will happen quickly
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        <h1 className="text-center glow emoji-float">
          Anti-Phishing System dApp
        </h1>

        <div className="text-right">
          <ConnectButton />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Connected Address */}
          <p style={{ fontSize: '1.1rem' }}>
            Connected as: <strong style={{ color: 'var(--cyan-primary)' }}>{address}</strong>
          </p>

          {/* Token Balance Section */}
          <div className="card">
            <h2>💰 Your APGT Balance</h2>
            {isLoadingTokenBalance ? (
              <div className="spinner"></div>
            ) : tokenBalanceError ? (
              <div className="alert alert-error">
                ⚠️ Error loading token balance: {tokenBalanceError}
              </div>
            ) : (
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                Balance: {tokenBalance ? ethers.formatEther(tokenBalance) : '0'} APGT
              </p>
            )}
            {/* Link to Faucet */}
            <Link to="/faucet" className="btn-outline" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
              Get Free APGT (Faucet)
            </Link>
          </div>

          {/* Delegate Votes Section */}
          <div className="card">
            <h2>🗳️ Delegate Your Votes</h2>
            <input
              placeholder="Delegatee Address (e.g., 0x...)"
              value={delegateeAddress}
              onChange={(e) => setDelegateeAddress(e.target.value)}
            />
            <button
              onClick={handleDelegate}
              className="btn btn-secondary"
              disabled={isDelegating}
            >
              {isDelegating ? 'Delegating...' : 'Delegate Votes'}
            </button>
            {isDelegateSuccess && (
              <div className="alert alert-success">
                ✅ Delegation successful! Tx: {delegateTxHash}
              </div>
            )}
            {delegateError && (
              <div className="alert alert-error">
                ❌ Delegation failed: {delegateError}
              </div>
            )}
          </div>

          {/* Updated "New Proposal?" Card with requirements */}
          <div className="card text-center">
            <h2>✨ New Proposal?</h2>
            {isLoadingMinHoldings || isLoadingOwner ? (
              <div className="spinner"></div>
            ) : minHoldingsError || ownerError ? (
              <div className="alert alert-error mb-3">
                ❌ Error loading proposal requirements.
              </div>
            ) : (
              <>
                <p className="text-muted mb-1">
                  To create an **'Add' proposal**, you need at least <strong style={{color: 'var(--cyan-light)'}}>{formattedMinHoldings} APGT</strong>.
                </p>
                <p className="text-muted mb-3">
                  **'Remove' proposals** can only be created by the contract owner: <strong style={{color: 'var(--cyan-light)'}}>{formattedOwnerAddress}</strong>.
                </p>
              </>
            )}
            <Link to="/proposals/create" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Create New Proposal
            </Link>
          </div>

          {/* Button to navigate to Blacklist Page */}
          <div className="card text-center">
            <h2>🚫 View Active Blacklist</h2>
            <p className="text-muted mb-3">See all currently blacklisted URLs and Ethereum addresses.</p>
            <Link to="/blacklist" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
              View Blacklist
            </Link>
          </div>

          {/* Proposals Dashboard */}
          <div className="card">
            <h2>📜 Proposals Dashboard</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input"
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Executed">Executed</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input"
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="">All Types</option>
                <option value="AddURL">Add URL</option>
                <option value="AddAddress">Add Address</option>
                <option value="RemoveURL">Remove URL</option>
                <option value="RemoveAddress">Remove Address</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input"
                style={{ flex: 1, minWidth: '150px' }}
              >
                <option value="newest">Sort by Newest</option>
                <option value="oldest">Sort by Oldest</option>
                <option value="mostVotes">Sort by Most Votes</option>
              </select>

              <button onClick={loadProposals} className="btn btn-primary" disabled={isLoadingProposals}>
                {isLoadingProposals ? 'Refreshing...' : 'Refresh Proposals'}
              </button>
            </div>

            {isLoadingProposals ? (
              <div className="spinner"></div>
            ) : proposalsError ? (
              <div className="alert alert-error">
                ❌ Error: {proposalsError}
              </div>
            ) : proposals.length === 0 ? (
              <p className="text-muted text-center">No proposals found matching your criteria.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {proposals.map(p => (
                  <div key={p.proposalId} className="card" style={{ background: 'var(--bg-tertiary)' }}>
                    <h3>Proposal ID: {p.proposalId}</h3>
                    <p><strong>Type:</strong> <span className="badge">{p.proposalType}</span></p>
                    <p><strong>Item:</strong> {p.urlValue || p.addressValue}</p>
                    <p><strong>Status:</strong> <span className="badge" style={{
                      background: p.status === 'Active' ? 'var(--blue-primary)' :
                                  p.status === 'Approved' ? 'var(--green-success)' :
                                  p.status === 'Executed' ? 'var(--green-success)' :
                                  'var(--red-danger)'
                    }}>{p.status}</span></p>
                    <p><strong>Proposer:</strong> {p.proposer}</p>
                    <p><strong>Created:</strong> {new Date(p.creationTimestamp).toLocaleString()}</p>
                    <p><strong>Ends:</strong> {new Date(p.votingPeriodEnd).toLocaleString()}</p>
                    <p><strong>Votes:</strong> Yes: {p.yesVotes} | No: {p.noVotes} | Total: {p.totalVoters}</p>
                    {p.description && <p><strong>Description:</strong> {p.description}</p>}
                    <Link to={`/proposals/${p.proposalId}`} className="btn-outline" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
                      View Details
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
