const { ethers } = require("hardhat");
require("dotenv").config(); // Ensure dotenv is loaded

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // --- 1. Deploy GovernanceToken ---
  const initialSupply = ethers.parseUnits("1000000", 18);
  const maxSupply = ethers.parseUnits("10000000", 18);
  const tokenName = "AntiPhish Governance Token";
  const tokenSymbol = "APGT";

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy(initialSupply, maxSupply, tokenName, tokenSymbol);
  await governanceToken.waitForDeployment();
  console.log(`GovernanceToken deployed to: ${governanceToken.target}`);

  // --- Identify Backend Minter Address ---
  // This will be the address of the wallet whose private key is in BACKEND_MINTER_PRIVATE_KEY
  const backendMinterPrivateKey = process.env.BACKEND_MINTER_PRIVATE_KEY;
  if (!backendMinterPrivateKey) {
    console.error("BACKEND_MINTER_PRIVATE_KEY is not set in .env. Cannot authorize faucet minter.");
    process.exit(1);
  }
  const backendMinterWallet = new ethers.Wallet(backendMinterPrivateKey, ethers.provider);
  const backendMinterAddress = backendMinterWallet.address;
  console.log(`Backend Faucet Minter Address identified: ${backendMinterAddress}`);


  // --- Authorize Backend Minter on GovernanceToken ---
  console.log(`Authorizing ${backendMinterAddress} as a minter on GovernanceToken...`);
  const addMinterTx = await governanceToken.addMinter(backendMinterAddress);
  await addMinterTx.wait();
  console.log(`Minter authorization complete. Tx hash: ${addMinterTx.hash}`);


  // --- 2. Deploy BlacklistRegistry ---
  const BlacklistRegistry = await ethers.getContractFactory("BlacklistRegistry");
  const blacklistRegistry = await BlacklistRegistry.deploy(deployer.address); // Placeholder for ProposalVoting
  await blacklistRegistry.waitForDeployment();
  console.log(`BlacklistRegistry deployed to: ${blacklistRegistry.target}`);

  // --- 3. Deploy ProposalVoting ---
  const minVotingPeriod = 60 * 2; 
  const minVotesForApproval = 1;
  const approvalMajorityPercentage = 51;
  const minProposerTokenHoldings = ethers.parseUnits("100", 18); // 100 APGT required for Add proposals

  const ProposalVoting = await ethers.getContractFactory("ProposalVoting");
  const proposalVoting = await ProposalVoting.deploy(
    blacklistRegistry.target,
    governanceToken.target,      // Pass the GovernanceToken address
    minVotingPeriod,
    minVotesForApproval,
    approvalMajorityPercentage,
    minProposerTokenHoldings
  );
  await proposalVoting.waitForDeployment();
  console.log(`ProposalVoting deployed to: ${proposalVoting.target}`);

  // --- 4. Link BlacklistRegistry to the actual ProposalVoting contract ---
  console.log("Updating BlacklistRegistry's ProposalVoting contract address...");
  const updateTx = await blacklistRegistry.updateProposalVotingContract(proposalVoting.target);
  await updateTx.wait();
  console.log("BlacklistRegistry updated with ProposalVoting address.");

  console.log("\nDeployment complete!");
  console.log(`
    Deployed Contracts:
    GovernanceToken: ${governanceToken.target}
    BlacklistRegistry: ${blacklistRegistry.target}
    ProposalVoting: ${proposalVoting.target}
    
    Configuration:
    Backend Faucet Minter: ${backendMinterAddress}
    Min Proposer Token Holdings: ${ethers.formatUnits(minProposerTokenHoldings, 18)} APGT
    Min Voting Period: ${minVotingPeriod} seconds (${minVotingPeriod / 3600} hours)
    Min Votes For Approval: ${minVotesForApproval}
    Approval Majority Percentage: ${approvalMajorityPercentage}%
  `);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
