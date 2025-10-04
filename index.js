import express from "express";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

// ---------------- Blockchain Setup ----------------
const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

// ---------------- Pinata Setup ----------------
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const pinataBaseUrl = "https://api.pinata.cloud/pinning";

// Upload image buffer to Pinata
async function uploadImageToPinata(fileBuffer, fileName) {
  const formData = new FormData();
  formData.append("file", fileBuffer, { filename: fileName });

  const response = await axios.post(`${pinataBaseUrl}/pinFileToIPFS`, formData, {
    maxBodyLength: "Infinity",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
  });

  return response.data.IpfsHash;
}

// Upload JSON metadata to Pinata
async function uploadJSONToPinata(jsonData) {
  const response = await axios.post(`${pinataBaseUrl}/pinJSONToIPFS`, jsonData, {
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
  });

  return response.data.IpfsHash;
}

// ---------------- Blockchain Functions ----------------
async function mintNFT(to, metadataUri) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataUri));
  const tx = await contract.safeMint(to, metadataUri, hash);
  await tx.wait();
  return tx.hash;
}

async function evolveNFT(tokenId, metadataUri) {
  const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataUri));
  const tx = await contract.commitEvolution(tokenId, metadataUri, hash);
  await tx.wait();
  return tx.hash;
}

async function getTokenURI(tokenId) {
  return await contract.tokenURI(tokenId);
}

// ---------------- API Endpoints ----------------

// Health check
app.head("/ping", (req, res) => {
  res.sendStatus(200);
});

// Mint NFT
app.post("/mint", async (req, res) => {
  try {
    const { to, metadataUri } = req.body; // metadataUri = ipfs://CID
    if (!to || !metadataUri) {
      return res.status(400).json({ error: "to and metadataUri are required" });
    }

    const txHash = await mintNFT(to, metadataUri);
    res.json({ success: true, txHash, metadataUri });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Evolve NFT with AI-generated image
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/evolve/:tokenId", upload.single("file"), async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { attributes } = req.body;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    // 1. Upload image
    const imageCid = await uploadImageToPinata(fileBuffer, fileName);

    // 2. Create metadata
    const metadata = {
      name: `Evolved NFT #${tokenId}`,
      description: "This NFT has evolved via AI.",
      image: `ipfs://${imageCid}`,
      attributes: attributes ? JSON.parse(attributes) : {},
    };

    // 3. Upload metadata JSON
    const metadataCid = await uploadJSONToPinata(metadata);

    // 4. Commit evolution on blockchain
    const txHash = await evolveNFT(tokenId, `ipfs://${metadataCid}`);

    res.json({
      success: true,
      txHash,
      imageCid,
      metadataCid,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch updated tokenURI
app.get("/token/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const uri = await getTokenURI(tokenId);
    res.json({ success: true, tokenId, uri });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- Server ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
