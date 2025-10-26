import React, { useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirection

function LandingPage() {
  const { isConnected } = useAccount();
  const navigate = useNavigate(); // Hook to programmatically navigate

  useEffect(() => {
    // If wallet is connected, redirect to the home page
    if (isConnected) {
      navigate('/home'); // Redirect to a new /home route
    }
  }, [isConnected, navigate]); // Re-run effect when connection status changes

  return (
    <div className="landing-page-container">
      <div className="landing-content">
        <h1 className="landing-title glow">Welcome to Anti-Phishing dApp!</h1>
        <p className="landing-description">
          Protect yourself and the community from malicious URLs and addresses.
          This decentralized application allows token holders to propose, vote on,
          and manage a community-driven blacklist.
        </p>
        <p className="landing-description">
          Join the fight against scams by connecting your wallet and participating
          in the governance process.
        </p>
        <div className="landing-connect-button">
          <ConnectButton />
        </div>
      </div>

      {/* Optional: Add some styling for the landing page */}
      <style>{`
        .landing-page-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: var(--bg-primary); /* Use your primary background color */
          color: var(--text-primary); /* Use your primary text color */
          text-align: center;
          padding: 2rem;
          box-sizing: border-box;
        }
        .landing-content {
          max-width: 700px;
          padding: 3rem;
          border-radius: 12px;
          background: var(--bg-secondary); /* Use a secondary background for the content card */
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
        }
        .landing-title {
          font-size: 3rem;
          margin-bottom: 1rem;
          color: var(--cyan-primary); /* A highlight color */
        }
        .landing-description {
          font-size: 1.1rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }
        .landing-connect-button {
          margin-top: 2rem;
        }
        /* Basic glow effect, adjust as needed */
        .glow {
          text-shadow: 0 0 5px var(--cyan-light), 0 0 10px var(--cyan-primary);
        }
        @media (max-width: 768px) {
          .landing-title {
            font-size: 2.5rem;
          }
          .landing-content {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
}

export default LandingPage;
