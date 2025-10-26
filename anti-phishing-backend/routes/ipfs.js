const express = require('express');
const multer = require('multer'); // For handling file uploads
const { pinFileToIPFS, getIpfsGatewayUrl } = require('../services/pinataService');

const router = express.Router();
const upload = multer(); // Configure multer for in-memory storage (file buffer)

/**
 * @route POST /api/ipfs/upload-evidence
 * @desc Uploads a file (evidence) to IPFS via Pinata and returns the CID.
 * @access Public (or add authentication/authorization as needed)
 */
router.post('/upload-evidence', upload.single('evidence'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    const cid = await pinFileToIPFS(fileBuffer, fileName);

    res.status(200).json({
      message: 'File uploaded to IPFS successfully',
      cid: cid,
      gatewayUrl: getIpfsGatewayUrl(cid)
    });
  } catch (error) {
    console.error('Error in /api/ipfs/upload-evidence:', error.message);
    res.status(500).json({ message: 'Failed to upload file to IPFS', error: error.message });
  }
});

/**
 * @route GET /api/ipfs/gateway/:cid
 * @desc Returns the Pinata gateway URL for a given CID.
 * @access Public
 */
router.get('/gateway/:cid', (req, res) => {
  try {
    const cid = req.params.cid;
    const gatewayUrl = getIpfsGatewayUrl(cid);
    res.status(200).json({ gatewayUrl: gatewayUrl });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
