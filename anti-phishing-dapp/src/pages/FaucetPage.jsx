import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query'; // For invalidating queries

// Import backend API services
import { claimFaucetTokens } from '../services/backendApi';

function FaucetPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient(); // Get query client for cache invalidation

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(null); // Stores txHash on success
  const [claimError, setClaimError] = useState(null);

  const handleClaimAPGT = async () => {
    if (!isConnected || !address) {
      setClaimError("Please connect your wallet to claim APGT.");
      return;
    }

    setIsClaiming(true);
    setClaimSuccess(null);
    setClaimError(null);

    try {
      const result = await claimFaucetTokens(address);
      setClaimSuccess(result.txHash);
      alert(`APGT claimed! Tx: ${result.txHash}`);

      // Invalidate the user's APGT balance query to force a re-fetch
      // This ensures the HomePage balance updates immediately
      queryClient.invalidateQueries({ queryKey: ['balanceOf', address] });
      
    } catch (err) {
      console.error("Error claiming APGT:", err);
      // Display specific error messages from backend if available
      setClaimError(err.response?.data?.message || err.message || "Failed to claim APGT.");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Header */}
        <h1 className="text-center glow">APGT Faucet (Testnet)</h1>

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

            <div className="card text-center">
              <h2>💧 Claim Free APGT Tokens</h2>
              <p className="text-muted mb-3">
  Connect your wallet and claim {import.meta.env.VITE_FAUCET_AMOUNT_APGT || '100'} APGT on Base Sepolia.
  <br/>Cooldown: {import.meta.env.VITE_FAUCET_COOLDOWN_HOURS || '48'} hours.
</p>

              <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                Your Address: <strong style={{ color: 'var(--cyan-primary)' }}>{address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'N/A'}</strong>
              </p>

              <button
                onClick={handleClaimAPGT}
                className="btn btn-primary"
                disabled={isClaiming || !isConnected}
              >
                {isClaiming ? 'Claiming APGT...' : 'Claim APGT'}
              </button>

              {claimSuccess && (
                <div className="alert alert-success mt-2">
                  ✅ APGT claimed successfully! Tx Hash: <a href={`https://sepolia.basescan.org/tx/${claimSuccess}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan-primary)' }}>{claimSuccess.substring(0, 10)}...</a>
                </div>
              )}
              {claimError && (
                <div className="alert alert-error mt-2">
                  ❌ Claim failed: {claimError}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="card text-center">
            <h2>👻 Connect your wallet to claim APGT</h2>
            <p className="text-muted">Click the "Connect Wallet" button above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FaucetPage;
