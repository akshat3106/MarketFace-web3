
# MarketFace Web3  

This is an **Express.js backend** for handling NFT minting and evolution with metadata and images stored on **Pinata IPFS**. It integrates with an Ethereum-compatible blockchain using **ethers.js**.  

## 🚀 Features
- Upload images to Pinata IPFS.  
- Generate and upload NFT metadata (JSON).  
- Mint NFTs with IPFS metadata.  
- Commit NFT evolutions (update metadata).  
- Fetch token URIs directly from the smart contract.  
- Simple `/ping` health check endpoint.  

---

## 📦 Tech Stack
- **Node.js / Express.js** – Backend framework.  
- **Multer** – File upload handling.  
- **Axios** – API requests to Pinata.  
- **Ethers.js** – Blockchain interaction.  
- **Pinata IPFS** – Decentralized storage for images and metadata.  

---

## ⚙️ Setup

### 1. Clone Repo
```bash
git clone https://github.com/your-username/evolving-nft-backend.git
cd evolving-nft-backend
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the root with the following:

```env
PORT=3000
RPC_URL=<your_rpc_url>
PRIVATE_KEY=<your_wallet_private_key>
CONTRACT_ADDRESS=<your_deployed_contract_address>
PINATA_API_KEY=<your_pinata_api_key>
PINATA_SECRET_API_KEY=<your_pinata_secret_key>
```

### 4. Run Server

```bash
npm start
```

Server will run at:

```
http://localhost:3000
```

---

## 🔑 API Endpoints

### Health Check

```http
HEAD /ping
```

**Response:** `200 OK`

---

### Upload Image + Metadata

```http
POST /upload-image
Content-Type: multipart/form-data
Field: image (file)
Body: { "name": "NFT Name", "description": "Desc", "attributes": "[{...}]" }
```

**Response:**

```json
{
  "success": true,
  "imageCid": "Qm....",
  "metadataCid": "Qm....",
  "metadataUri": "ipfs://Qm....",
  "metadata": { ... }
}
```

---

### Mint NFT

```http
POST /mint
Content-Type: application/json
{
  "to": "0xRecipientAddress",
  "metadataUri": "ipfs://Qm...."
}
```

**Response:**

```json
{
  "success": true,
  "txHash": "0x...",
  "metadataUri": "ipfs://Qm...."
}
```

---

### Evolve NFT

```http
POST /evolve/:tokenId
Content-Type: application/json
{
  "metadataUri": "ipfs://Qm...."
}
```

**Response:**

```json
{
  "success": true,
  "txHash": "0x...",
  "tokenId": "1",
  "metadataUri": "ipfs://Qm...."
}
```

---

### Get Token URI

```http
GET /token/:tokenId
```

**Response:**

```json
{
  "success": true,
  "tokenId": "1",
  "uri": "ipfs://Qm...."
}
```

---

## 🛠️ Smart Contract Assumptions

The backend expects your deployed contract to expose these functions:

* `safeMint(address to, string memory metadataUri, bytes32 hash)`
* `commitEvolution(uint256 tokenId, string memory metadataUri, bytes32 hash)`
* `tokenURI(uint256 tokenId) public view returns (string memory)`

---

## 📝 License

MIT License
