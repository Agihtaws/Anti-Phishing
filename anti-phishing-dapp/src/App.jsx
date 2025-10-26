import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage'; // <--- NEW: Import LandingPage
import HomePage from './pages/HomePage';
import ProposalDetailsPage from './pages/ProposalDetailsPage';
import CreateProposalPage from './pages/CreateProposalPage';
import BlacklistPage from './pages/BlacklistPage';
import FaucetPage from './pages/FaucetPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} /> {/* <--- NEW: LandingPage as root */}
        <Route path="/home" element={<HomePage />} /> {/* <--- CHANGED: HomePage is now /home */}
        <Route path="/proposals/:id" element={<ProposalDetailsPage />} />
        <Route path="/proposals/create" element={<CreateProposalPage />} />
        <Route path="/blacklist" element={<BlacklistPage />} />
        <Route path="/faucet" element={<FaucetPage />} />
      </Routes>
    </Router>
  );
}

export default App;
