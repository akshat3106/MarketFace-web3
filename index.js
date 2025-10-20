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

//blockchain setup
const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

//pinata setup
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_BASE_URL = "https://api.pinata.cloud/pinning";

const storage = multer.memoryStorage();
const upload = multer({ storage });

//image upload to ipfs
async function uploadImageToPinata(fileBuffer, fileName) {
  const formData = new FormData();
  formData.append("file", fileBuffer, { filename: fileName });

  const response = await axios.post(`${PINATA_BASE_URL}/pinFileToIPFS`, formData, {
    maxBodyLength: Infinity,
    headers: {
      ...formData.getHeaders(),
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
  });

  return response.data.IpfsHash;
}

//upload json metadata to ipfs
async function uploadJSONToPinata(jsonData) {
  const response = await axios.post(`${PINATA_BASE_URL}/pinJSONToIPFS`, jsonData, {
    headers: {
      "Content-Type": "application/json",
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_API_KEY,
    },
  });
  return response.data.IpfsHash;
}

//blockchain functions
async function mintNFT(to, metadataUri) {
  if (!contract) throw new Error("Contract not initialized properly");

  const hash = ethers.keccak256(ethers.toUtf8Bytes(metadataUri));
  // Mint the NFT
  const tx = await contract.safeMint(to, metadataUri, hash);
  const receipt = await tx.wait();
  // Get tokenId from event logs
  const event = receipt.logs.find(log => log.fragment?.name === "Transfer");
  const tokenId = event ? ethers.getBigInt(event.args.tokenId).toString() : "unknown";
  return {
    success: true,
    txHash: tx.hash,
    tokenId,
    metadataUri,
  };
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



app.head("/ping", (req, res) => res.sendStatus(200));

//mint nft
app.post("/mint", async (req, res) => {
  try {
    const { to, metadataUri } = req.body;
    if (!to || !metadataUri) {
      return res.status(400).json({ error: "to and metadataUri are required" });
    }
    const result = await mintNFT(to, metadataUri);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//evolve nft
app.post("/evolve/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { metadataUri } = req.body;

    if (!metadataUri) {
      return res.status(400).json({ error: "metadataUri is required" });
    }

    const txHash = await evolveNFT(tokenId, metadataUri);
    res.json({ success: true, txHash, tokenId, metadataUri });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//upload image
app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Field name must be 'file'." });
    }

    const { name, description, attributes } = req.body;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    console.log(`✅ Received file: ${fileName}`);

    const imageCid = await uploadImageToPinata(fileBuffer, fileName);

    const metadata = {
      name: name || "Untitled NFT",
      description: description || "No description provided",
      image: `ipfs://${imageCid}`,
      attributes: attributes ? JSON.parse(attributes) : [],
    };

    const metadataCid = await uploadJSONToPinata(metadata);

    res.json({
      success: true,
      imageCid,
      metadataCid,
      metadataUri: `ipfs://${metadataCid}`,
      metadata,
    });
  } catch (err) {
    console.error("Upload Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get("/token/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const uri = await getTokenURI(tokenId);
    res.json({ success: true, tokenId, uri });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(400).json({ error: err.message });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});