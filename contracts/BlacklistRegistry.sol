// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BlacklistRegistry
 * @dev This contract stores and manages a decentralized blacklist of malicious URLs and Ethereum addresses.
 *      Entries can only be added or removed by a designated ProposalVoting contract, ensuring community consensus.
 */
contract BlacklistRegistry {
    // Enum to differentiate between types of blacklisted entries
    enum EntryType {
        URL,
        Address
    }

    // Struct to store details about each blacklisted entry
    struct BlacklistEntry {
        EntryType entryType;
        uint256 timestamp; // When the entry was added
        address proposer; // The address that proposed the entry
        bool exists; // To easily check if an entry exists
    }

    // Mappings to store blacklisted URLs and addresses
    mapping(string => BlacklistEntry) private blacklistedURLs;
    mapping(address => BlacklistEntry) private blacklistedAddresses;

    // Address of the ProposalVoting contract, which is authorized to modify the blacklist
    address public proposalVotingContract;

    // Owner address for critical administrative functions
    address public owner;

    // Events to log when entries are added or removed
    event EntryAdded(EntryType indexed _type, string _value, address _address, uint256 _timestamp, address _proposer);
    event EntryRemoved(EntryType indexed _type, string _value, address _address, uint256 _timestamp, address _remover);
    event ProposalVotingContractUpdated(address indexed _oldContract, address indexed _newContract, uint256 _timestamp);
    event OwnershipTransferred(address indexed _previousOwner, address indexed _newOwner);

    /**
     * @dev Constructor sets the address of the authorized ProposalVoting contract and the owner.
     * @param _proposalVotingContract The address of the ProposalVoting contract.
     */
    constructor(address _proposalVotingContract) {
        require(_proposalVotingContract != address(0), "ProposalVoting contract address cannot be zero");
        proposalVotingContract = _proposalVotingContract;
        owner = msg.sender;
    }

    /**
     * @dev Modifier to restrict functions to be called only by the designated ProposalVoting contract.
     */
    modifier onlyProposalVotingContract() {
        require(msg.sender == proposalVotingContract, "Only ProposalVoting contract can call this function");
        _;
    }

    /**
     * @dev Modifier to restrict functions to be called only by the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /**
     * @dev Adds a URL to the blacklist. Callable only by the ProposalVoting contract.
     * @param _url The URL to blacklist.
     * @param _proposer The address that originally proposed this entry.
     */
    function addURL(string memory _url, address _proposer) external onlyProposalVotingContract {
        require(bytes(_url).length > 0, "URL cannot be empty");
        require(!blacklistedURLs[_url].exists, "URL is already blacklisted");
        require(_proposer != address(0), "Proposer address cannot be zero");

        blacklistedURLs[_url] = BlacklistEntry({
            entryType: EntryType.URL,
            timestamp: block.timestamp,
            proposer: _proposer,
            exists: true
        });

        emit EntryAdded(EntryType.URL, _url, address(0), block.timestamp, _proposer);
    }

    /**
     * @dev Adds an Ethereum address to the blacklist. Callable only by the ProposalVoting contract.
     * @param _address The address to blacklist.
     * @param _proposer The address that originally proposed this entry.
     */
    function addAddress(address _address, address _proposer) external onlyProposalVotingContract {
        require(_address != address(0), "Address cannot be zero");
        require(!blacklistedAddresses[_address].exists, "Address is already blacklisted");
        require(_proposer != address(0), "Proposer address cannot be zero");

        blacklistedAddresses[_address] = BlacklistEntry({
            entryType: EntryType.Address,
            timestamp: block.timestamp,
            proposer: _proposer,
            exists: true
        });

        emit EntryAdded(EntryType.Address, "", _address, block.timestamp, _proposer);
    }

    /**
     * @dev Removes a URL from the blacklist. Callable only by the ProposalVoting contract.
     * @param _url The URL to remove.
     * @param _remover The address that proposed the removal.
     */
    function removeURL(string memory _url, address _remover) external onlyProposalVotingContract {
        require(bytes(_url).length > 0, "URL cannot be empty");
        require(blacklistedURLs[_url].exists, "URL is not blacklisted");
        require(_remover != address(0), "Remover address cannot be zero");

        delete blacklistedURLs[_url];

        emit EntryRemoved(EntryType.URL, _url, address(0), block.timestamp, _remover);
    }

    /**
     * @dev Removes an Ethereum address from the blacklist. Callable only by the ProposalVoting contract.
     * @param _address The address to remove.
     * @param _remover The address that proposed the removal.
     */
    function removeAddress(address _address, address _remover) external onlyProposalVotingContract {
        require(_address != address(0), "Address cannot be zero");
        require(blacklistedAddresses[_address].exists, "Address is not blacklisted");
        require(_remover != address(0), "Remover address cannot be zero");

        delete blacklistedAddresses[_address];

        emit EntryRemoved(EntryType.Address, "", _address, block.timestamp, _remover);
    }

    /**
     * @dev Checks if a given URL is blacklisted.
     * @param _url The URL to check.
     * @return True if the URL is blacklisted, false otherwise.
     */
    function isURLBlacklisted(string memory _url) public view returns (bool) {
        return blacklistedURLs[_url].exists;
    }

    /**
     * @dev Checks if a given Ethereum address is blacklisted.
     * @param _address The address to check.
     * @return True if the address is blacklisted, false otherwise.
     */
    function isAddressBlacklisted(address _address) public view returns (bool) {
        return blacklistedAddresses[_address].exists;
    }

    /**
     * @dev Retrieves details of a blacklisted URL.
     * @param _url The URL to query.
     * @return A BlacklistEntry struct containing details.
     */
    function getURLDetails(string memory _url) public view returns (BlacklistEntry memory) {
        require(blacklistedURLs[_url].exists, "URL is not blacklisted");
        return blacklistedURLs[_url];
    }

    /**
     * @dev Retrieves details of a blacklisted Ethereum address.
     * @param _address The address to query.
     * @return A BlacklistEntry struct containing details.
     */
    function getAddressDetails(address _address) public view returns (BlacklistEntry memory) {
        require(blacklistedAddresses[_address].exists, "Address is not blacklisted");
        return blacklistedAddresses[_address];
    }

    /**
     * @dev Updates the ProposalVoting contract address. Only callable by owner.
     * @param _newProposalVotingContract The new ProposalVoting contract address.
     */
    function updateProposalVotingContract(address _newProposalVotingContract) external onlyOwner {
        require(_newProposalVotingContract != address(0), "New ProposalVoting contract address cannot be zero");
        require(_newProposalVotingContract != proposalVotingContract, "New address must be different");

        address oldContract = proposalVotingContract;
        proposalVotingContract = _newProposalVotingContract;

        emit ProposalVotingContractUpdated(oldContract, _newProposalVotingContract, block.timestamp);
    }

    /**
     * @dev Transfers ownership of the contract to a new address. Only callable by current owner.
     * @param _newOwner The address of the new owner.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "New owner address cannot be zero");
        require(_newOwner != owner, "New owner must be different from current owner");

        address previousOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    /**
     * @dev Batch check multiple URLs for blacklist status.
     * @param _urls Array of URLs to check.
     * @return Array of booleans indicating blacklist status for each URL.
     */
    function batchCheckURLs(string[] memory _urls) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_urls.length);
        for (uint256 i = 0; i < _urls.length; i++) {
            results[i] = blacklistedURLs[_urls[i]].exists;
        }
        return results;
    }

    /**
     * @dev Batch check multiple addresses for blacklist status.
     * @param _addresses Array of addresses to check.
     * @return Array of booleans indicating blacklist status for each address.
     */
    function batchCheckAddresses(address[] memory _addresses) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            results[i] = blacklistedAddresses[_addresses[i]].exists;
        }
        return results;
    }
}
