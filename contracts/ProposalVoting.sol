// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BlacklistRegistry.sol";
import "./GovernanceToken.sol";

/**
 * @title ProposalVoting
 * @dev This contract manages the creation, voting, and execution of proposals
 *      to add or remove entries from the BlacklistRegistry.
 *      It implements a community-driven consensus mechanism with token-gated proposal creation.
 */
contract ProposalVoting {
    // Reference to the BlacklistRegistry contract
    BlacklistRegistry public blacklistRegistry;
    
    // Reference to the GovernanceToken contract
    GovernanceToken public governanceTokenContract;

    // Enum for the type of action a proposal represents
    enum ProposalType {
        AddURL,
        AddAddress,
        RemoveURL,
        RemoveAddress
    }

    // Enum for the current status of a proposal
    enum ProposalStatus {
        Active,    // Open for voting
        Approved,  // Voting period ended, threshold met
        Rejected,  // Voting period ended, threshold not met
        Executed   // Action taken on BlacklistRegistry
    }

    // Struct to define a proposal
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        string urlValue;
        address addressValue;
        string description;
        uint256 creationTimestamp;
        uint256 votingPeriodEnd;
        address proposer;
        uint256 yesVotes;
        uint256 noVotes;
        ProposalStatus status;
        mapping(address => bool) hasVoted;
        uint256 totalVoters;
    }

    // Mapping from proposal ID to Proposal struct
    mapping(uint256 => Proposal) public proposals;
    uint256 public nextProposalId;

    // Configuration parameters for voting
    uint256 public minVotingPeriod;
    uint256 public minVotesForApproval;
    uint256 public approvalMajorityPercentage;
    
    // Minimum token holdings required to create "Add" proposals
    uint256 public minProposerTokenHoldings;

    // Owner address for critical administrative functions
    address public owner;

    // Events to log key actions
    event ProposalCreated(uint256 indexed proposalId, ProposalType indexed _type, string _url, address _address, string _description, address indexed _proposer, uint256 _creationTimestamp, uint256 _votingPeriodEnd);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool _support, uint256 _yesVotes, uint256 _noVotes);
    event ProposalStatusUpdated(uint256 indexed proposalId, ProposalStatus _oldStatus, ProposalStatus _newStatus);
    event ProposalExecuted(uint256 indexed proposalId, ProposalType indexed _type, string _url, address _address, address indexed executor);
    event VotingParametersUpdated(uint256 _minVotingPeriod, uint256 _minVotesForApproval, uint256 _approvalMajorityPercentage);
    event BlacklistRegistryUpdated(address indexed _oldAddress, address indexed _newAddress);
    event OwnershipTransferred(address indexed _previousOwner, address indexed _newOwner);
    event MinProposerTokenHoldingsUpdated(uint256 _oldAmount, uint256 _newAmount);

    /**
     * @dev Constructor sets the address of the BlacklistRegistry contract and initial voting parameters.
     * @param _blacklistRegistryAddress The address of the BlacklistRegistry contract.
     * @param _governanceTokenAddress The address of the GovernanceToken contract.
     * @param _minVotingPeriod The minimum duration for a proposal to be active (in seconds).
     * @param _minVotesForApproval The minimum number of 'yes' votes required for a proposal to pass.
     * @param _approvalMajorityPercentage The percentage of 'yes' votes (out of total voters) for approval (1-100).
     * @param _minProposerTokenHoldings The minimum token balance required to create "Add" proposals.
     */
    constructor(
        address _blacklistRegistryAddress, 
        address _governanceTokenAddress,
        uint256 _minVotingPeriod, 
        uint256 _minVotesForApproval, 
        uint256 _approvalMajorityPercentage,
        uint256 _minProposerTokenHoldings
    ) {
        require(_blacklistRegistryAddress != address(0), "BlacklistRegistry address cannot be zero");
        require(_governanceTokenAddress != address(0), "GovernanceToken address cannot be zero");
        require(_minVotingPeriod > 0, "Min voting period must be greater than zero");
        require(_approvalMajorityPercentage > 0 && _approvalMajorityPercentage <= 100, "Approval majority percentage must be between 1 and 100");

        blacklistRegistry = BlacklistRegistry(_blacklistRegistryAddress);
        governanceTokenContract = GovernanceToken(_governanceTokenAddress);
        minVotingPeriod = _minVotingPeriod;
        minVotesForApproval = _minVotesForApproval;
        approvalMajorityPercentage = _approvalMajorityPercentage;
        minProposerTokenHoldings = _minProposerTokenHoldings;
        nextProposalId = 1;
        owner = msg.sender;
    }

    /**
     * @dev Modifier to restrict functions to be called only by the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Modifier to check if a proposal with the given ID exists.
     * @param _proposalId The ID of the proposal.
     */
    modifier proposalExists(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId < nextProposalId, "Proposal does not exist");
        _;
    }

    /**
     * @dev Modifier to check if a proposal is currently active for voting.
     * @param _proposalId The ID of the proposal.
     */
    modifier proposalActive(uint256 _proposalId) {
        require(proposals[_proposalId].status == ProposalStatus.Active, "Proposal is not active");
        require(block.timestamp < proposals[_proposalId].votingPeriodEnd, "Voting period has ended");
        _;
    }

    /**
     * @dev Modifier to check if a proposal's voting period has ended and it's ready for resolution (Approved/Rejected).
     *      This is for the step where the outcome is determined, not final execution.
     * @param _proposalId The ID of the proposal.
     */
    modifier proposalReadyToResolve(uint256 _proposalId) {
        require(proposals[_proposalId].status == ProposalStatus.Active, "Proposal not in active state for resolution");
        require(block.timestamp >= proposals[_proposalId].votingPeriodEnd, "Voting period has not ended yet");
        _;
    }

    /**
     * @dev Creates a new proposal to add or remove a URL or address from the blacklist.
     * @param _type The type of action (AddURL, AddAddress, RemoveURL, RemoveAddress).
     * @param _url The URL to propose (if _type is URL related).
     * @param _address The address to propose (if _type is Address related).
     * @param _description A description or reason for the proposal.
     * @param _userDefinedVotingDurationInSeconds The desired voting duration in seconds.
     * @return The ID of the newly created proposal.
     */
    function createProposal(
        ProposalType _type,
        string memory _url,
        address _address,
        string memory _description,
        uint256 _userDefinedVotingDurationInSeconds // NEW PARAMETER
    ) external returns (uint256) {
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_userDefinedVotingDurationInSeconds > 0, "Voting duration must be greater than zero"); // Added check

        // Token-gating for "Add" proposals
        if (_type == ProposalType.AddURL || _type == ProposalType.AddAddress) {
            require(
                governanceTokenContract.balanceOf(msg.sender) >= minProposerTokenHoldings,
                "Insufficient APGT to create Add proposal"
            );
        }
        
        // Owner-gating for "Remove" proposals
        if (_type == ProposalType.RemoveURL || _type == ProposalType.RemoveAddress) {
            require(msg.sender == owner, "Only owner can create Remove proposals");
        }

        uint256 proposalId = nextProposalId++;

        // NEW LOGIC: Calculate actual voting duration, enforcing minVotingPeriod
        uint256 actualVotingDuration = _userDefinedVotingDurationInSeconds;
        if (actualVotingDuration < minVotingPeriod) {
            actualVotingDuration = minVotingPeriod; // Enforce contract's minimum
        }

        uint256 votingEnd = block.timestamp + actualVotingDuration; // Use calculated duration
        
        // Input validation based on proposal type
        if (_type == ProposalType.AddURL || _type == ProposalType.RemoveURL) {
            require(bytes(_url).length > 0, "URL cannot be empty for URL-related proposal");
            require(_address == address(0), "Address must be zero for URL-related proposal");
        } else if (_type == ProposalType.AddAddress || _type == ProposalType.RemoveAddress) {
            require(_address != address(0), "Address cannot be zero for Address-related proposal");
            require(bytes(_url).length == 0, "URL must be empty for Address-related proposal");
        } else {
            revert("Invalid proposal type");
        }

        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposalType = _type;
        newProposal.urlValue = _url;
        newProposal.addressValue = _address;
        newProposal.description = _description;
        newProposal.creationTimestamp = block.timestamp;
        newProposal.votingPeriodEnd = votingEnd; // Ensure this is correctly assigned
        newProposal.proposer = msg.sender;
        newProposal.yesVotes = 0;
        newProposal.noVotes = 0;
        newProposal.status = ProposalStatus.Active;
        newProposal.totalVoters = 0;

        emit ProposalCreated(proposalId, _type, _url, _address, _description, msg.sender, block.timestamp, votingEnd);
        return proposalId;
    }

    /**
     * @dev Allows a user to cast a vote (yes or no) on an active proposal.
     * @param _proposalId The ID of the proposal to vote on.
     * @param _support True for a 'yes' vote, false for a 'no' vote.
     */
    function vote(uint256 _proposalId, bool _support) external proposalExists(_proposalId) proposalActive(_proposalId) {
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.hasVoted[msg.sender], "Already voted on this proposal");

        proposal.hasVoted[msg.sender] = true;
        proposal.totalVoters++;

        if (_support) {
            proposal.yesVotes++;
        } else {
            proposal.noVotes++;
        }

        emit VoteCast(_proposalId, msg.sender, _support, proposal.yesVotes, proposal.noVotes);
    }

    /**
     * @dev Ends the voting period for a proposal and updates its status to Approved or Rejected.
     *      Anyone can call this function after the voting period has ended.
     *      This function does NOT execute the action on the BlacklistRegistry directly.
     * @param _proposalId The ID of the proposal to finalize the voting outcome.
     */
    function endProposalAndExecute(uint256 _proposalId) external proposalExists(_proposalId) proposalReadyToResolve(_proposalId) { // Changed modifier
        Proposal storage proposal = proposals[_proposalId];
        ProposalStatus oldStatus = proposal.status; // Store old status for event

        bool meetsApprovalCriteria = false;
        
        // Check if the proposal meets the minimum 'yes' votes and majority percentage
        if (proposal.yesVotes >= minVotesForApproval && proposal.totalVoters > 0) {
            uint256 actualMajorityPercentage = (proposal.yesVotes * 100) / proposal.totalVoters;
            if (actualMajorityPercentage >= approvalMajorityPercentage) {
                meetsApprovalCriteria = true;
            }
        }

        if (meetsApprovalCriteria) {
            proposal.status = ProposalStatus.Approved; // <--- Proposal is now Approved
        } else {
            proposal.status = ProposalStatus.Rejected; // <--- Proposal is now Rejected
        }

        emit ProposalStatusUpdated(_proposalId, oldStatus, proposal.status);
        // IMPORTANT: NO ProposalExecuted event or BlacklistRegistry interaction here
    }

    /**
     * @dev Executes an approved proposal on the BlacklistRegistry.
     *      Can only be called if the proposal is in the 'Approved' state.
     *      Only the owner of ProposalVoting can trigger this final execution.
     * @param _proposalId The ID of the proposal to execute.
     */
    function executeApprovedProposal(uint256 _proposalId)
        external
        onlyOwner // Only the contract owner can execute approved proposals
        proposalExists(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.status == ProposalStatus.Approved, "Proposal is not in Approved state for execution");
        // No need for block.timestamp check here, as 'Approved' implies voting period ended.
        
        ProposalStatus oldStatus = proposal.status; // Store old status for event

        // Execute the action on the BlacklistRegistry
        if (proposal.proposalType == ProposalType.AddURL) {
            blacklistRegistry.addURL(proposal.urlValue, proposal.proposer);
        } else if (proposal.proposalType == ProposalType.AddAddress) {
            blacklistRegistry.addAddress(proposal.addressValue, proposal.proposer);
        } else if (proposal.proposalType == ProposalType.RemoveURL) {
            blacklistRegistry.removeURL(proposal.urlValue, proposal.proposer);
        } else if (proposal.proposalType == ProposalType.RemoveAddress) {
            blacklistRegistry.removeAddress(proposal.addressValue, proposal.proposer);
        }

        proposal.status = ProposalStatus.Executed; // <--- Now set to Executed here
        emit ProposalExecuted(_proposalId, proposal.proposalType, proposal.urlValue, proposal.addressValue, msg.sender);
        emit ProposalStatusUpdated(_proposalId, oldStatus, proposal.status);
    }

    /**
     * @dev Retrieves the details of a specific proposal.
     * @param _proposalId The ID of the proposal.
     * @return id The proposal ID.
     * @return proposalType The type of proposal.
     * @return urlValue The URL value if applicable.
     * @return addressValue The address value if applicable.
     * @return description The proposal description.
     * @return creationTimestamp When the proposal was created.
     * @return votingPeriodEnd When the voting period ends.
     * @return proposer The address that created the proposal.
     * @return yesVotes The number of yes votes.
     * @return noVotes The number of no votes.
     * @return status The current proposal status.
     * @return totalVoters The total number of voters.
     */
    function getProposal(uint256 _proposalId)
        public
        view
        proposalExists(_proposalId)
        returns (
            uint256 id,
            ProposalType proposalType,
            string memory urlValue,
            address addressValue,
            string memory description,
            uint256 creationTimestamp,
            uint256 votingPeriodEnd,
            address proposer,
            uint256 yesVotes,
            uint256 noVotes,
            ProposalStatus status,
            uint256 totalVoters
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.id,
            proposal.proposalType,
            proposal.urlValue,
            proposal.addressValue,
            proposal.description,
            proposal.creationTimestamp,
            proposal.votingPeriodEnd,
            proposal.proposer,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.status,
            proposal.totalVoters
        );
    }

    /**
     * @dev Checks if an address has voted on a specific proposal.
     * @param _proposalId The ID of the proposal.
     * @param _voter The address to check.
     * @return True if the address has voted, false otherwise.
     */
    function hasVotedOnProposal(uint256 _proposalId, address _voter) external view proposalExists(_proposalId) returns (bool) {
        return proposals[_proposalId].hasVoted[_voter];
    }

    /**
     * @dev Returns the current voting results for a proposal.
     * @param _proposalId The ID of the proposal.
     * @return yesVotes The number of yes votes.
     * @return noVotes The number of no votes.
     * @return totalVoters The total number of voters.
     * @return majorityPercentage The current percentage of yes votes.
     */
    function getVotingResults(uint256 _proposalId) 
        external 
        view 
        proposalExists(_proposalId) 
        returns (
            uint256 yesVotes,
            uint256 noVotes,
            uint256 totalVoters,
            uint256 majorityPercentage
        ) 
    {
        Proposal storage proposal = proposals[_proposalId];
                uint256 percentage = 0;
        
        if (proposal.totalVoters > 0) {
            percentage = (proposal.yesVotes * 100) / proposal.totalVoters;
        }
        
        return (
            proposal.yesVotes,
            proposal.noVotes,
            proposal.totalVoters,
            percentage
        );
    }

    /**
     * @dev Checks if a proposal will be approved based on current votes.
     * @param _proposalId The ID of the proposal.
     * @return True if the proposal meets approval criteria, false otherwise.
     */
    function willProposalPass(uint256 _proposalId) 
        external 
        view 
        proposalExists(_proposalId) 
        returns (bool) 
    {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.yesVotes < minVotesForApproval || proposal.totalVoters == 0) {
            return false;
        }
        
        uint256 actualMajorityPercentage = (proposal.yesVotes * 100) / proposal.totalVoters;
        return actualMajorityPercentage >= approvalMajorityPercentage;
    }

    /**
     * @dev Returns all active proposal IDs (proposals that are still open for voting).
     * @return An array of active proposal IDs.
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        
        // Count active proposals
        for (uint256 i = 1; i < nextProposalId; i++) {
            if (proposals[i].status == ProposalStatus.Active && block.timestamp < proposals[i].votingPeriodEnd) {
                activeCount++;
            }
        }
        
        // Create array and populate
        uint256[] memory activeProposals = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextProposalId; i++) {
            if (proposals[i].status == ProposalStatus.Active && block.timestamp < proposals[i].votingPeriodEnd) {
                activeProposals[index] = i;
                index++;
            }
        }
        
        return activeProposals;
    }

    /**
     * @dev Returns proposals that are ready to be resolved (Approved/Rejected) after voting period.
     * @return An array of proposal IDs ready for resolution.
     */
    function getProposalsReadyToResolve() external view returns (uint256[] memory) { // New function, similar to old getProposalsReadyToExecute
        uint256 readyCount = 0;
        
        // Count ready proposals
        for (uint256 i = 1; i < nextProposalId; i++) {
            if (proposals[i].status == ProposalStatus.Active && block.timestamp >= proposals[i].votingPeriodEnd) {
                readyCount++;
            }
        }
        
        // Create array and populate
        uint256[] memory readyProposals = new uint256[](readyCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextProposalId; i++) {
            if (proposals[i].status == ProposalStatus.Active && block.timestamp >= proposals[i].votingPeriodEnd) {
                readyProposals[index] = i;
                index++;
            }
        }
        
        return readyProposals;
    }

    /**
     * @dev Returns the total number of proposals created.
     * @return The total proposal count.
     */
    function getTotalProposalCount() external view returns (uint256) {
        return nextProposalId - 1;
    }

    /**
     * @dev Allows the owner to update the address of the BlacklistRegistry contract.
     * @param _newBlacklistRegistryAddress The new address for the BlacklistRegistry contract.
     */
    function updateBlacklistRegistry(address _newBlacklistRegistryAddress) external onlyOwner {
        require(_newBlacklistRegistryAddress != address(0), "New BlacklistRegistry address cannot be zero");
        require(_newBlacklistRegistryAddress != address(blacklistRegistry), "New address must be different");

        address oldAddress = address(blacklistRegistry);
        blacklistRegistry = BlacklistRegistry(_newBlacklistRegistryAddress);
        emit BlacklistRegistryUpdated(oldAddress, _newBlacklistRegistryAddress);
    }

    /**
     * @dev Allows the owner to update voting parameters.
     * @param _newMinVotingPeriod The new minimum voting period in seconds.
     * @param _newMinVotesForApproval The new minimum number of 'yes' votes required.
     * @param _newApprovalMajorityPercentage The new percentage for majority approval (1-100).
     */
    function updateVotingParameters(uint256 _newMinVotingPeriod, uint256 _newMinVotesForApproval, uint256 _newApprovalMajorityPercentage) external onlyOwner {
        require(_newMinVotingPeriod > 0, "Min voting period must be greater than zero");
        require(_newApprovalMajorityPercentage > 0 && _newApprovalMajorityPercentage <= 100, "Approval majority percentage must be between 1 and 100");

        minVotingPeriod = _newMinVotingPeriod;
        minVotesForApproval = _newMinVotesForApproval;
        approvalMajorityPercentage = _newApprovalMajorityPercentage;
        emit VotingParametersUpdated(_newMinVotingPeriod, _newMinVotesForApproval, _newApprovalMajorityPercentage);
    }

    /**
     * @dev Allows the owner to update the minimum token holdings required for creating Add proposals.
     * @param _newMinProposerTokenHoldings The new minimum token balance required.
     */
    function updateMinProposerTokenHoldings(uint256 _newMinProposerTokenHoldings) external onlyOwner {
        uint256 oldAmount = minProposerTokenHoldings;
        minProposerTokenHoldings = _newMinProposerTokenHoldings;
        emit MinProposerTokenHoldingsUpdated(oldAmount, _newMinProposerTokenHoldings);
    }

    /**
     * @dev Transfers ownership of the contract to a new address.
     * @param _newOwner The address of the new owner.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "New owner address cannot be zero");
        require(_newOwner != owner, "New owner must be different from current owner");

        address previousOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }
}
