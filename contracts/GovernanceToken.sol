// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GovernanceToken
 * @dev This contract implements an ERC-20 compliant token with snapshot and delegation
 *      capabilities for the Decentralized Anti-Phishing & Scam Warning System.
 *      Token holders can use these tokens to participate in voting with snapshot-based
 *      voting power calculation and delegation support.
 */
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes, Ownable {
    // Maximum supply cap to prevent unlimited inflation
    uint256 public immutable maxSupply;
    
    // Mapping to track if an address is authorized to mint (for distribution mechanisms)
    mapping(address => bool) public minters;

    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @dev Constructor mints the initial total supply of tokens to the deployer.
     *      Initializes the ERC20 token with a name and symbol, and sets the owner.
     * @param _initialSupply The initial total supply of tokens to be minted.
     * @param _maxSupply The maximum total supply that can ever exist.
     * @param _name The name of the token (e.g., "AntiPhish Governance Token").
     * @param _symbol The symbol of the token (e.g., "APGT").
     */
    constructor(
        uint256 _initialSupply,
        uint256 _maxSupply,
        string memory _name,
        string memory _symbol
    )
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Ownable(msg.sender)
    {
        require(_initialSupply > 0, "Initial supply must be greater than zero");
        require(_maxSupply >= _initialSupply, "Max supply must be >= initial supply");
        
        maxSupply = _maxSupply;
        _mint(msg.sender, _initialSupply);
    }

    /**
     * @dev Mints new tokens and assigns them to an account.
     *      Can only be called by the contract owner or authorized minters.
     *      This function serves as the distribution mechanism for new tokens.
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     */
    function mint(address _to, uint256 _amount) external {
        require(msg.sender == owner() || minters[msg.sender], "Not authorized to mint");
        require(_to != address(0), "Cannot mint to the zero address");
        require(totalSupply() + _amount <= maxSupply, "Would exceed max supply");
        
        _mint(_to, _amount);
    }

    /**
     * @dev Burns tokens from the caller's balance.
     * @param _amount The amount of tokens to burn.
     */
    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
        emit TokensBurned(msg.sender, _amount);
    }

    /**
     * @dev Adds an address as an authorized minter.
     * @param _minter The address to authorize for minting.
     */
    function addMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Cannot add zero address as minter");
        require(!minters[_minter], "Address is already a minter");
        
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }

    /**
     * @dev Removes an address from authorized minters.
     * @param _minter The address to remove from minting authorization.
     */
    function removeMinter(address _minter) external onlyOwner {
        require(minters[_minter], "Address is not a minter");
        
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }

    /**
     * @dev Batch transfer tokens to multiple addresses.
     *      Useful for airdrops and initial distribution.
     * @param _recipients Array of recipient addresses.
     * @param _amounts Array of token amounts corresponding to each recipient.
     */
    function batchTransfer(address[] calldata _recipients, uint256[] calldata _amounts) external {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        require(_recipients.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Cannot transfer to zero address");
            _transfer(msg.sender, _recipients[i], _amounts[i]);
        }
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
