
# 🛡️ Anti-Phishing Shield dApp

## 💡 Inspiration

In the rapidly evolving Web3 space, phishing attacks and scams are a persistent threat, leading to significant financial losses and eroding trust. Existing solutions are often centralized, slow to react, or lack transparency.  

We envision a **community-driven, decentralized defense system** where users actively contribute to identifying and mitigating these threats.  

The **Anti-Phishing Shield dApp** empowers the Web3 community to collaboratively build and maintain a transparent, immutable blacklist of malicious URLs and Ethereum addresses, making the internet safer for everyone.

---

## 🚀 What it Does

The Anti-Phishing Shield dApp is a comprehensive decentralized application enabling the Web3 community to collectively identify, vote on, and enforce a blacklist of phishing sites and scam contracts.

### Key Features

#### Decentralized Governance
- **Token-Gated "Add" Proposal Creation:** Users must hold a minimum amount of APGT (AntiPhish Governance Token) to propose new blacklist entries.  
- **Owner-Gated "Remove" Proposal Creation:** Only the ProposalVoting contract owner can propose removals, which still require community voting.  
- **Community Voting:** APGT holders vote "Yes" or "No" on proposals.  
- **User-Defined Voting Duration:** Custom voting periods can be set for proposals, with a contract-enforced minimum.  
- **Proposal Execution:** Approved proposals are executed automatically on-chain after voting ends.

#### Transparent Blacklist
- **Publicly Viewable:** A dedicated Blacklist Page displays all active blacklisted URLs and Ethereum addresses.  
- **Search & Filter:** Easily find specific threats or types of entries.  
- **Immutable Record:** All changes are recorded on the Base Sepolia blockchain.

#### IPFS-Backed Evidence
- Proposers can upload supporting evidence (screenshots, reports) to IPFS.  
- IPFS Content Identifiers (CIDs) are included in proposals for immutability and verification.

#### APGT Faucet (Testnet)
- **Faucet:** New users can claim free APGT tokens to meet proposal creation requirements.  
- **Minter Authorization:** Specific addresses authorized by the contract owner can mint APGT tokens.

#### Robust Backend
- Node.js backend indexes smart contract events into MongoDB.  
- Data powers fast display of proposals and blacklist on the frontend.  
- Integrates with Pinata for reliable IPFS pinning.

---

## 🔒 Threat Model

### Sybil Attacks / Spam Proposals
- **Threat:** Fake identities flood the system.  
- **Defense:** Token-gated proposals and faucet rate limits make spam economically infeasible.

### Malicious "Remove" Proposals
- **Threat:** Attackers attempt to remove phishing sites.  
- **Defense:** Only the trusted owner can propose removals; community vote ensures legitimacy.

### Vote Manipulation / Flash Loans
- **Threat:** Temporary acquisition of tokens to manipulate votes.  
- **Defense:** ERC20Votes with snapshot-based voting prevents flash loan exploits.

### Centralized Control / Censorship
- **Threat:** Single entity controls blacklist.  
- **Defense:** Community voting and immutable blockchain records ensure decentralization.

### Data Tampering
- **Threat:** Blacklist or evidence is altered.  
- **Defense:** Blockchain immutability and IPFS storage ensure tamper-proof records.

---

## ⚙️ Tech Stack

- **Smart Contracts:** Solidity, Hardhat, OpenZeppelin Contracts (ERC20Votes, Ownable)  
- **Blockchain:** Base Sepolia Testnet  
- **Frontend (dApp):** React.js (Vite), Wagmi, RainbowKit, React Router, Custom CSS  
- **Backend:** Node.js, Express.js, Mongoose, Ethers.js, Axios, Multer, Pinata API, Dotenv  
- **Database:** MongoDB

---

## 🎬 Demo Video

[Insert Demo Video Link Here]

## Live Demo
*   Frontend - https://anti-phishing-frontend.onrender.com
*   Backend - https://anti-phishing-backend.onrender.com

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+) & npm  
- Git  
- MongoDB instance (local or Atlas)  
- MetaMask wallet(s) with Base Sepolia ETH  
- WalletConnect Cloud Project ID  
- Pinata API Keys

### 1. Clone the Repository
```bash
git clone https://github.com/Agihtaws/Anti-Phishing.git
cd Anti-Phishing
````

### 2. Smart Contract Setup & Deployment

```bash
npm install
npx hardhat compile
```

* Configure `.env` with private keys and RPC URLs.
  ```bash
  PRIVATE_KEY=
  BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
  BACKEND_MINTER_PRIVATE_KEY=
  ```
* Modify `deploy.js` for a short voting period (e.g., 2 min for hackathon testing).
* Deploy contracts:

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

### 3. Backend Setup

```bash
cd anti-phishing-backend
npm install
```

* Configure `.env` with contract addresses, Pinata API keys, and faucet settings.
  ```bash
  MONGODB_URI="mongodb://localhost:27017/back"
  BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/Alchemy_Key"
  BLACKLIST_REGISTRY_ADDRESS="0xc4786A371c38D54aD548d556bb6a404A5Fdef67C"
  PROPOSAL_VOTING_ADDRESS="0x84c9DD4A0ed723d39da90d27b344Fd2B29347293"
  GOVERNANCE_TOKEN_ADDRESS="0xe103d6dfCF96F7b9ae82d9D5fa14a56CA1B4Bd0f"
  PINATA_API_KEY=
  PINATA_SECRET_API_KEY=
  PINATA_JWT=
  BACKEND_MINTER_PRIVATE_KEY=
  FAUCET_AMOUNT_APGT="100"
  FAUCET_COOLDOWN_HOURS="24"
  ```
* Run backend:

```bash
node server.js
```

### 4. Frontend dApp Setup

```bash
cd ../anti-phishing-dapp
npm install
```

* Configure `.env` with contract addresses, WalletConnect Project ID, and backend API URL.
  ```bash
  VITE_BLACKLIST_REGISTRY_ADDRESS="0xc4786A371c38D54aD548d556bb6a404A5Fdef67C"
  VITE_PROPOSAL_VOTING_ADDRESS="0x84c9DD4A0ed723d39da90d27b344Fd2B29347293"
  VITE_GOVERNANCE_TOKEN_ADDRESS="0xe103d6dfCF96F7b9ae82d9D5fa14a56CA1B4Bd0f"
  VITE_BACKEND_API_URL="http://localhost:5000/api"
  VITE_BASE_SEPOLIA_CHAIN_ID="84532"
  VITE_BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/Alchemy_Key"
  VITE_FAUCET_AMOUNT_APGT=100
  VITE_FAUCET_COOLDOWN_HOURS=24
  VITE_WALLETCONNECT_PROJECT_ID=
  ```
* Run frontend:

```bash
npm run dev
```

* Open `http://localhost:5173` in a browser.

---

## 🔮 Future Enhancements

* **Browser Extension:** Real-time page scanning, instant warnings, transaction warnings.
* **Advanced Reputation System:** Track governance participants.
* **Integration with Threat Intelligence Feeds**
* **Proactive Notification System:** Email/Discord for proposals and voting deadlines.
* **User Profiles:** History of proposals and votes.

---

