import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { evaluateIntent, getRecommendedFee } from './evaluate';
import { buildBabelTransaction, submitBabelTransaction } from './wallet';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Step 1: Frontend requests a fully formed transaction
app.post('/build-intent', async (req, res) => {
    try {
        const { senderAddress, recipientAddress, sendAmount, sendTokenId, feeOffered, feeTokenId } = req.body;
        
        if (!senderAddress || !recipientAddress || !sendAmount || !sendTokenId || !feeOffered || !feeTokenId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Evaluate profitability
        const isProfitable = await evaluateIntent(feeOffered, feeTokenId);
        if (!isProfitable) {
            return res.status(400).json({ error: 'Fee offered is too low or unacceptable' });
        }

        // Build the transaction
        const unsignedTxCbor = await buildBabelTransaction({
            senderAddress,
            recipientAddress,
            sendAmount,
            sendTokenId,
            feeOffered,
            feeTokenId
        });
        
        return res.status(200).json({ success: true, unsignedTxCbor });
    } catch (error: any) {
        console.error('Error building intent:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Step 2: Frontend submits the transaction after the user signs it
app.post('/submit-intent', async (req, res) => {
    try {
        const { signedTxCbor } = req.body;
        
        if (!signedTxCbor) {
            return res.status(400).json({ error: 'Missing signedTxCbor' });
        }

        const txHash = await submitBabelTransaction(signedTxCbor);
        
        return res.status(200).json({ success: true, txHash });
    } catch (error: any) {
        console.error('Error submitting intent:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Step 3: Frontend requests a live quote for the fee
app.post('/quote-fee', async (req, res) => {
    try {
        const { feeTokenId } = req.body;
        if (!feeTokenId) {
            return res.status(400).json({ error: 'Missing feeTokenId' });
        }
        
        const recommendedAmount = await getRecommendedFee(feeTokenId);
        return res.status(200).json({ success: true, recommendedAmount });
    } catch (error: any) {
        console.error('Error quoting fee:', error);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Relayer Backend listening on port ${PORT}`);
});
