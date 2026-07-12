# Nexus Relayer
**Team Name:** EL8  
**Team Member:** Snehith Kumar Humnabad  

## Project Description
Nexus Relayer is a complete end-to-end Babel Fee implementation for the Cardano blockchain. It allows users to pay their Cardano network transaction fees using any Native Token (like $SNEK or $HOSKY) instead of ADA.

## What problem you are trying to solve
Cardano requires ADA to pay for network gas fees. This creates massive friction for new users and dApp participants who hold native tokens or stablecoins but have `0 ADA` in their wallets. They are forced to use central exchanges just to fund their wallets for a $0.15 fee. 

Nexus Relayer completely eliminates the need for ADA by intercepting user intents and dynamically co-signing them on behalf of a Relayer. 

## Tech Stack
*   **Frontend:** Next.js (React), TailwindCSS, Framer Motion, Lucid Evolution
*   **Backend:** Express.js (Node.js), Lucid Evolution, Blockfrost API
*   **Oracle:** Live CoinGecko API Integration

## Project Demo
Our project features a premium glassmorphic UI, live wallet balance scanning, and a live pricing oracle that automatically quotes the required fee based on real-world USD prices.

*(Please insert your Demo Photos / Videos Here)*

## GitHub Repository
[https://github.com/snehith50h-ai/Nexus-Relayer](https://github.com/snehith50h-ai/Nexus-Relayer)

## Live Project Link
Not deployed yet. (Running on Localhost / Preprod Testnet)

## PPT Link
*(Please insert your PPT Link Here)*

---

## How to Run Locally

### 1. Start the Backend Relayer Oracle
The backend node evaluates transactions against live CoinGecko prices and co-signs them.
```bash
cd EL8/relayer-backend
npm install
npm run start
```
*The backend will run on `http://localhost:3001`*

### 2. Start the Frontend UI
The frontend is a Next.js application that provides the Glassmorphism UI.
```bash
cd EL8/frontend
npm install
npm run dev
```
*The frontend will be accessible at `http://localhost:3000`*
