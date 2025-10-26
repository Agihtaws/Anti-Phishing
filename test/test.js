const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Anti-Phishing System Integration Tests", function () {
  let governanceToken;
  let blacklistRegistry;
  let proposalVoting;
  let owner;
  let user1;
  let user2;
  let user3;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
  const MAX_SUPPLY = ethers.parseUnits("10000000", 18);
  const MIN_PROPOSER_TOKEN_HOLDINGS = ethers.parseUnits("100", 18);
  const MIN_VOTING_PERIOD = 3600; // 1 hour
  const MIN_VOTES_FOR_APPROVAL = 1;
  const APPROVAL_MAJORITY_PERCENTAGE = 51;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy GovernanceToken
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceToken.deploy(
      INITIAL_SUPPLY,
      MAX_SUPPLY,
      "AntiPhish Governance Token",
      "APGT"
    );
    await governanceToken.waitForDeployment();

    // Deploy BlacklistRegistry with owner as temporary ProposalVoting
    const BlacklistRegistry = await ethers.getContractFactory("BlacklistRegistry");
    blacklistRegistry = await BlacklistRegistry.deploy(owner.address);
    await blacklistRegistry.waitForDeployment();

    // Deploy ProposalVoting
    const ProposalVoting = await ethers.getContractFactory("ProposalVoting");
    proposalVoting = await ProposalVoting.deploy(
      await blacklistRegistry.getAddress(),
      await governanceToken.getAddress(),
      MIN_VOTING_PERIOD,
      MIN_VOTES_FOR_APPROVAL,
      APPROVAL_MAJORITY_PERCENTAGE,
      MIN_PROPOSER_TOKEN_HOLDINGS
    );
    await proposalVoting.waitForDeployment();

    // Update BlacklistRegistry to use ProposalVoting
    await blacklistRegistry.updateProposalVotingContract(await proposalVoting.getAddress());

    // Transfer tokens to users for testing
    await governanceToken.transfer(user1.address, ethers.parseUnits("200", 18));
    await governanceToken.transfer(user2.address, ethers.parseUnits("50", 18));
  });

  describe("GovernanceToken", function () {
    it("Should deploy with correct initial supply", async function () {
      expect(await governanceToken.totalSupply()).to.equal(INITIAL_SUPPLY);
      expect(await governanceToken.balanceOf(owner.address)).to.equal(
        INITIAL_SUPPLY - ethers.parseUnits("250", 18)
      );
    });

    it("Should allow token transfers", async function () {
      const transferAmount = ethers.parseUnits("50", 18);
      await governanceToken.connect(user1).transfer(user3.address, transferAmount);
      expect(await governanceToken.balanceOf(user3.address)).to.equal(transferAmount);
    });

    it("Should allow batch transfers", async function () {
      const recipients = [user2.address, user3.address];
      const amounts = [ethers.parseUnits("10", 18), ethers.parseUnits("20", 18)];
      
      await governanceToken.connect(user1).batchTransfer(recipients, amounts);
      
      expect(await governanceToken.balanceOf(user2.address)).to.equal(ethers.parseUnits("60", 18));
      expect(await governanceToken.balanceOf(user3.address)).to.equal(ethers.parseUnits("20", 18));
    });

    it("Should allow burning tokens", async function () {
      const burnAmount = ethers.parseUnits("10", 18);
      const initialBalance = await governanceToken.balanceOf(user1.address);
      
      await governanceToken.connect(user1).burn(burnAmount);
      
      expect(await governanceToken.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should enforce max supply on minting", async function () {
      const mintAmount = MAX_SUPPLY - INITIAL_SUPPLY + ethers.parseUnits("1", 18);
      await expect(
        governanceToken.mint(user1.address, mintAmount)
      ).to.be.revertedWith("Would exceed max supply");
    });
  });

  describe("ProposalVoting - Token Gating", function () {
    it("Should allow user with sufficient tokens to create Add URL proposal", async function () {
      const tx = await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://malicious-site.com",
        ethers.ZeroAddress,
        "This is a phishing site"
      );
      
      await expect(tx).to.emit(proposalVoting, "ProposalCreated");
      
      const proposal = await proposalVoting.getProposal(1);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.urlValue).to.equal("https://malicious-site.com");
    });

    it("Should prevent user with insufficient tokens from creating Add proposal", async function () {
      await expect(
        proposalVoting.connect(user2).createProposal(
          0, // AddURL
          "https://malicious-site.com",
          ethers.ZeroAddress,
          "This is a phishing site"
        )
      ).to.be.revertedWith("Insufficient APGT to create Add proposal");
    });

    it("Should allow only owner to create Remove proposals", async function () {
      // First add a URL through a proposal
      await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://malicious-site.com",
        ethers.ZeroAddress,
        "This is a phishing site"
      );

      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      // Owner creates remove proposal
      const tx = await proposalVoting.connect(owner).createProposal(
        2, // RemoveURL
        "https://malicious-site.com",
        ethers.ZeroAddress,
        "False positive"
      );
      
      await expect(tx).to.emit(proposalVoting, "ProposalCreated");
    });

    it("Should prevent non-owner from creating Remove proposals", async function () {
      await expect(
        proposalVoting.connect(user1).createProposal(
          2, // RemoveURL
          "https://some-site.com",
          ethers.ZeroAddress,
          "Trying to remove"
        )
      ).to.be.revertedWith("Only owner can create Remove proposals");
    });
  });

  describe("Full Proposal Lifecycle", function () {
    it("Should complete full Add URL proposal lifecycle", async function () {
      // Create proposal
      await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://scam-site.com",
        ethers.ZeroAddress,
        "Confirmed phishing site"
      );

      // Vote on proposal
      await proposalVoting.connect(user1).vote(1, true);
      await proposalVoting.connect(user2).vote(1, true);

      // Check voting results
      const results = await proposalVoting.getVotingResults(1);
      expect(results.yesVotes).to.equal(2);
      expect(results.noVotes).to.equal(0);

      // Fast forward time
      await time.increase(MIN_VOTING_PERIOD + 1);

      // Execute proposal
      await proposalVoting.endProposalAndExecute(1);

      // Verify URL is blacklisted
      expect(await blacklistRegistry.isURLBlacklisted("https://scam-site.com")).to.be.true;

      // Check proposal status
      const proposal = await proposalVoting.getProposal(1);
      expect(proposal.status).to.equal(3); // Executed
    });

    it("Should complete full Add Address proposal lifecycle", async function () {
      const maliciousAddress = user3.address;

      // Create proposal
      await proposalVoting.connect(user1).createProposal(
        1, // AddAddress
        "",
        maliciousAddress,
        "Known scammer address"
      );

      // Vote on proposal
      await proposalVoting.connect(user1).vote(1, true);

      // Fast forward time
      await time.increase(MIN_VOTING_PERIOD + 1);

      // Execute proposal
      await proposalVoting.endProposalAndExecute(1);

      // Verify address is blacklisted
      expect(await blacklistRegistry.isAddressBlacklisted(maliciousAddress)).to.be.true;
    });

    it("Should reject proposal with insufficient votes", async function () {
      // Create proposal
      await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://maybe-bad-site.com",
        ethers.ZeroAddress,
        "Suspicious site"
      );

      // Vote against
      await proposalVoting.connect(user1).vote(1, false);
      await proposalVoting.connect(user2).vote(1, false);

      // Fast forward time
      await time.increase(MIN_VOTING_PERIOD + 1);

      // Execute proposal
      await proposalVoting.endProposalAndExecute(1);

      // Verify URL is NOT blacklisted
      expect(await blacklistRegistry.isURLBlacklisted("https://maybe-bad-site.com")).to.be.false;

      // Check proposal status
      const proposal = await proposalVoting.getProposal(1);
      expect(proposal.status).to.equal(2); // Rejected
    });

    it("Should prevent double voting", async function () {
      await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://test-site.com",
        ethers.ZeroAddress,
        "Test"
      );

      await proposalVoting.connect(user1).vote(1, true);

      await expect(
        proposalVoting.connect(user1).vote(1, true)
      ).to.be.revertedWith("Already voted on this proposal");
    });

    it("Should prevent voting after voting period ends", async function () {
      await proposalVoting.connect(user1).createProposal(
        0, // AddURL
        "https://test-site.com",
        ethers.ZeroAddress,
        "Test"
      );

      await time.increase(MIN_VOTING_PERIOD + 1);

      await expect(
        proposalVoting.connect(user1).vote(1, true)
      ).to.be.revertedWith("Voting period has ended");
    });
  });

  describe("BlacklistRegistry Integration", function () {
    it("Should batch check multiple URLs", async function () {
      // Add URLs through proposals
      await proposalVoting.connect(user1).createProposal(0, "https://bad1.com", ethers.ZeroAddress, "Bad site 1");
      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      await proposalVoting.connect(user1).createProposal(0, "https://bad2.com", ethers.ZeroAddress, "Bad site 2");
      await proposalVoting.connect(user1).vote(2, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(2);

      // Batch check
      const urls = ["https://bad1.com", "https://bad2.com", "https://good.com"];
      const results = await blacklistRegistry.batchCheckURLs(urls);

      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
      expect(results[2]).to.be.false;
    });

    it("Should batch check multiple addresses", async function () {
      // Add addresses through proposals
      await proposalVoting.connect(user1).createProposal(1, "", user2.address, "Bad address 1");
      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      await proposalVoting.connect(user1).createProposal(1, "", user3.address, "Bad address 2");
      await proposalVoting.connect(user1).vote(2, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(2);

      // Batch check
      const addresses = [user2.address, user3.address, owner.address];
      const results = await blacklistRegistry.batchCheckAddresses(addresses);

      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
      expect(results[2]).to.be.false;
    });

    it("Should get URL details after blacklisting", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://phishing.com", ethers.ZeroAddress, "Phishing");
      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      const details = await blacklistRegistry.getURLDetails("https://phishing.com");
      expect(details.exists).to.be.true;
      expect(details.proposer).to.equal(user1.address);
      expect(details.entryType).to.equal(0); // URL
    });
  });

  describe("Administrative Functions", function () {
    it("Should allow owner to update minimum proposer token holdings", async function () {
      const newMinimum = ethers.parseUnits("200", 18);
      await proposalVoting.updateMinProposerTokenHoldings(newMinimum);
      expect(await proposalVoting.minProposerTokenHoldings()).to.equal(newMinimum);
    });

    it("Should allow owner to update voting parameters", async function () {
      await proposalVoting.updateVotingParameters(7200, 2, 60);
      expect(await proposalVoting.minVotingPeriod()).to.equal(7200);
      expect(await proposalVoting.minVotesForApproval()).to.equal(2);
      expect(await proposalVoting.approvalMajorityPercentage()).to.equal(60);
    });

    it("Should allow owner to transfer ownership", async function () {
      await proposalVoting.transferOwnership(user1.address);
      expect(await proposalVoting.owner()).to.equal(user1.address);
    });

    it("Should prevent non-owner from updating parameters", async function () {
      await expect(
        proposalVoting.connect(user1).updateMinProposerTokenHoldings(ethers.parseUnits("50", 18))
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Query Functions", function () {
    it("Should return active proposals", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://site1.com", ethers.ZeroAddress, "Site 1");
      await proposalVoting.connect(user1).createProposal(0, "https://site2.com", ethers.ZeroAddress, "Site 2");

      const activeProposals = await proposalVoting.getActiveProposals();
      expect(activeProposals.length).to.equal(2);
      expect(activeProposals[0]).to.equal(1);
      expect(activeProposals[1]).to.equal(2);
    });

    it("Should return proposals ready to execute", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://site1.com", ethers.ZeroAddress, "Site 1");
      await proposalVoting.connect(user1).createProposal(0, "https://site2.com", ethers.ZeroAddress, "Site 2");

      await proposalVoting.connect(user1).vote(1, true);
      await proposalVoting.connect(user1).vote(2, true);

      await time.increase(MIN_VOTING_PERIOD + 1);

      const readyProposals = await proposalVoting.getProposalsReadyToExecute();
      expect(readyProposals.length).to.equal(2);
      expect(readyProposals[0]).to.equal(1);
      expect(readyProposals[1]).to.equal(2);
    });

    it("Should return total proposal count", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://site1.com", ethers.ZeroAddress, "Site 1");
      await proposalVoting.connect(user1).createProposal(0, "https://site2.com", ethers.ZeroAddress, "Site 2");
      await proposalVoting.connect(user1).createProposal(0, "https://site3.com", ethers.ZeroAddress, "Site 3");

      expect(await proposalVoting.getTotalProposalCount()).to.equal(3);
    });

    it("Should check if address has voted on proposal", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://site1.com", ethers.ZeroAddress, "Site 1");
      
      expect(await proposalVoting.hasVotedOnProposal(1, user1.address)).to.be.false;
      
      await proposalVoting.connect(user1).vote(1, true);
      
      expect(await proposalVoting.hasVotedOnProposal(1, user1.address)).to.be.true;
      expect(await proposalVoting.hasVotedOnProposal(1, user2.address)).to.be.false;
    });

    it("Should check if proposal will pass", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://site1.com", ethers.ZeroAddress, "Site 1");
      
      expect(await proposalVoting.willProposalPass(1)).to.be.false;
      
      await proposalVoting.connect(user1).vote(1, true);
      
      expect(await proposalVoting.willProposalPass(1)).to.be.true;
    });

    it("Should get min proposer token holdings", async function () {
      expect(await proposalVoting.minProposerTokenHoldings()).to.equal(MIN_PROPOSER_TOKEN_HOLDINGS);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle proposal with exactly minimum votes", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://edge-case.com", ethers.ZeroAddress, "Edge case");
      
      await proposalVoting.connect(user1).vote(1, true);
      
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      expect(await blacklistRegistry.isURLBlacklisted("https://edge-case.com")).to.be.true;
    });

    it("Should handle proposal with exactly 51% approval", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://majority-test.com", ethers.ZeroAddress, "Majority test");
      
      await proposalVoting.connect(user1).vote(1, true);
      await proposalVoting.connect(user2).vote(1, false);
      
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      const proposal = await proposalVoting.getProposal(1);
      expect(proposal.status).to.equal(2); // Rejected (50% is not >= 51%)
    });

    it("Should prevent executing proposal before voting period ends", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://early-execute.com", ethers.ZeroAddress, "Early execute");
      
      await proposalVoting.connect(user1).vote(1, true);

      await expect(
        proposalVoting.endProposalAndExecute(1)
      ).to.be.revertedWith("Voting period has not ended yet");
    });

    it("Should prevent executing already executed proposal", async function () {
      await proposalVoting.connect(user1).createProposal(0, "https://double-execute.com", ethers.ZeroAddress, "Double execute");
      
      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(1);

      await expect(
        proposalVoting.endProposalAndExecute(1)
      ).to.be.revertedWith("Proposal not in active state for execution");
    });

    it("Should handle remove proposal for non-existent entry", async function () {
      await proposalVoting.connect(owner).createProposal(2, "https://non-existent.com", ethers.ZeroAddress, "Remove non-existent");
      
      await proposalVoting.connect(user1).vote(1, true);
      await time.increase(MIN_VOTING_PERIOD + 1);

      await expect(
        proposalVoting.endProposalAndExecute(1)
      ).to.be.revertedWith("URL is not blacklisted");
    });

    it("Should handle empty description rejection", async function () {
      await expect(
        proposalVoting.connect(user1).createProposal(0, "https://no-desc.com", ethers.ZeroAddress, "")
      ).to.be.revertedWith("Description cannot be empty");
    });

    it("Should handle invalid proposal type inputs", async function () {
      await expect(
        proposalVoting.connect(user1).createProposal(0, "", ethers.ZeroAddress, "Empty URL")
      ).to.be.revertedWith("URL cannot be empty for URL-related proposal");

      await expect(
        proposalVoting.connect(user1).createProposal(1, "", ethers.ZeroAddress, "Zero address")
      ).to.be.revertedWith("Address cannot be zero for Address-related proposal");
    });
  });

  describe("Complete Workflow Test", function () {
    it("Should complete full system workflow with multiple proposals", async function () {
      // Step 1: User1 creates proposal to add malicious URL
      await proposalVoting.connect(user1).createProposal(
        0,
        "https://scam-crypto.com",
        ethers.ZeroAddress,
        "Fake crypto exchange"
      );

      // Step 2: User1 creates another proposal to add malicious address
      await proposalVoting.connect(user1).createProposal(
        1,
        "",
        user3.address,
        "Known scammer wallet"
      );

      // Step 3: Multiple users vote on both proposals
      await proposalVoting.connect(user1).vote(1, true);
      await proposalVoting.connect(user2).vote(1, true);
      await proposalVoting.connect(user1).vote(2, true);

      // Step 4: Check voting results before execution
      const results1 = await proposalVoting.getVotingResults(1);
      expect(results1.yesVotes).to.equal(2);

      // Step 5: Fast forward time
      await time.increase(MIN_VOTING_PERIOD + 1);

      // Step 6: Execute both proposals
      await proposalVoting.endProposalAndExecute(1);
      await proposalVoting.endProposalAndExecute(2);

      // Step 7: Verify both entries are blacklisted
      expect(await blacklistRegistry.isURLBlacklisted("https://scam-crypto.com")).to.be.true;
      expect(await blacklistRegistry.isAddressBlacklisted(user3.address)).to.be.true;

      // Step 8: Owner creates removal proposal
      await proposalVoting.connect(owner).createProposal(
        2,
        "https://scam-crypto.com",
        ethers.ZeroAddress,
        "False positive - site is legitimate"
      );

      // Step 9: Vote and execute removal
      await proposalVoting.connect(user1).vote(3, true);
      await time.increase(MIN_VOTING_PERIOD + 1);
      await proposalVoting.endProposalAndExecute(3);

      // Step 10: Verify URL is removed from blacklist
      expect(await blacklistRegistry.isURLBlacklisted("https://scam-crypto.com")).to.be.false;
      expect(await blacklistRegistry.isAddressBlacklisted(user3.address)).to.be.true;

      // Step 11: Verify total proposal count
      expect(await proposalVoting.getTotalProposalCount()).to.equal(3);
    });
  });
});
