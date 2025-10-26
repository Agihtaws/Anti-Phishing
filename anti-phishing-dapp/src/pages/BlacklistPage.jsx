import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Link } from 'react-router-dom';

// Import backend API services
import { fetchBlacklistedURLs, fetchBlacklistedAddresses } from '../services/backendApi';

function BlacklistPage() {
  const { isConnected } = useAccount();

  const [blacklistedItems, setBlacklistedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'URL', 'Address'

  // --- Function to fetch blacklisted items from backend ---
  const loadBlacklist = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [urls, addresses] = await Promise.all([
        fetchBlacklistedURLs(),
        fetchBlacklistedAddresses(),
      ]);

      // Combine and add a 'source' property for filtering
      const combinedList = [
        ...urls.map(item => ({ ...item, type: 'URL' })),
        ...addresses.map(item => ({ ...item, type: 'Address' })),
      ];
      setBlacklistedItems(combinedList);

    } catch (err) {
      console.error("Error loading blacklist:", err);
      setError(err.message || "Failed to load blacklist items.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Effect to load blacklist on component mount ---
  useEffect(() => {
    if (isConnected) { // Only load if wallet is connected
      loadBlacklist();
    } else {
      setBlacklistedItems([]); // Clear list if disconnected
    }
  }, [isConnected]); // Re-load when connection status changes


  // --- Filtering and Searching Logic ---
  const filteredItems = blacklistedItems.filter(item => {
    const matchesSearchTerm = searchTerm === '' ||
                              item.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.proposer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilterType = filterType === 'all' || item.type === filterType;

    return matchesSearchTerm && matchesFilterType;
  });

  return (
    <div className="container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Header */}
        <h1 className="text-center glow">Current Blacklist</h1>

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

            <div className="card">
              <h2>🚫 Active Blacklisted Items</h2>

              {/* Search and Filter Controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  placeholder="Search URL or Address or Proposer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                  style={{ flex: 2, minWidth: '200px' }}
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="input"
                  style={{ flex: 1, minWidth: '100px' }}
                >
                  <option value="all">All Types</option>
                  <option value="URL">URLs</option>
                  <option value="Address">Addresses</option>
                </select>
                <button onClick={loadBlacklist} className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Refreshing...' : 'Refresh List'}
                </button>
              </div>

              {isLoading ? (
                <div className="spinner"></div>
              ) : error ? (
                <div className="alert alert-error">
                  ❌ Error: {error}
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="text-muted text-center">No blacklisted items found matching your criteria.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {filteredItems.map((item, index) => (
                    <div key={index} className="card" style={{ background: 'var(--bg-tertiary)' }}>
                      <h3>Value: {item.value}</h3>
                      <p><strong>Type:</strong> <span className="badge" style={{ background: item.type === 'URL' ? 'var(--red-danger)' : 'var(--purple-accent)' }}>{item.type}</span></p>
                      <p><strong>Proposer:</strong> {item.proposer}</p>
                      <p><strong>Added:</strong> {new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="card text-center">
            <h2>👻 Connect your wallet to view the blacklist</h2>
            <p className="text-muted">Click the "Connect Wallet" button above to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlacklistPage;
