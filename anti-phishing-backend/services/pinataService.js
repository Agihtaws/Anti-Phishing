const axios = require('axios');
const FormData = require('form-data'); // Required for file uploads

const pinataApiUrl = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const pinataGatewayUrl = 'https://gateway.pinata.cloud/ipfs/'; // For retrieving content

/**
 * @dev Pins a file to IPFS via Pinata.
 * @param {Buffer} fileBuffer The buffer of the file to pin.
 * @param {string} fileName The name of the file.
 * @returns {Promise<string>} The IPFS CID (Content Identifier) of the pinned file.
 */
const pinFileToIPFS = async (fileBuffer, fileName) => {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filepath: fileName // Set filename for Pinata
    });

    const metadata = JSON.stringify({
      name: fileName,
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
      cidVersion: 0, // Using CIDv0, change to 1 if needed
    });
    formData.append('pinataOptions', options);

    const response = await axios.post(pinataApiUrl, formData, {
      maxBodyLength: 'Infinity', // This is important for large files
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
        'Authorization': `Bearer ${process.env.PINATA_JWT}` // Using JWT for authentication
      }
    });

    if (response.status === 200 && response.data.IpfsHash) {
      console.log(`PinataService: File '${fileName}' pinned to IPFS with CID: ${response.data.IpfsHash}`);
      return response.data.IpfsHash;
    } else {
      throw new Error(`Pinata API error: ${response.status} - ${response.data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`PinataService: Error pinning file '${fileName}' to IPFS:`, error.message);
    if (error.response) {
      console.error("PinataService: Pinata response data:", error.response.data);
    }
    throw new Error('Failed to pin file to IPFS');
  }
};

/**
 * @dev Retrieves content from IPFS via Pinata's gateway.
 * @param {string} cid The IPFS CID of the content.
 * @returns {string} The URL to access the content via Pinata's gateway.
 */
const getIpfsGatewayUrl = (cid) => {
  if (!cid) {
    throw new Error("CID cannot be empty for gateway URL");
  }
  return `${pinataGatewayUrl}${cid}`;
};

module.exports = {
  pinFileToIPFS,
  getIpfsGatewayUrl
};
