import { Blockfrost, Lucid } from "@lucid-evolution/lucid";
import type { UTxO } from "@lucid-evolution/lucid";
import dotenv from 'dotenv';

dotenv.config();

export interface BabelTxParams {
    senderAddress: string;
    recipientAddress: string;
    sendAmount: string;
    sendTokenId: string;
    feeOffered: string;
    feeTokenId: string;
}

// Ensure you have these in your .env file
const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID || ''; 
const relayerSeedPhrase = process.env.RELAYER_SEED_PHRASE || ''; 

async function getLucid() {
    const provider = new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        blockfrostProjectId
    );

    const lucid = await Lucid(provider, "Preprod");
    lucid.selectWallet.fromSeed(relayerSeedPhrase);
    return lucid;
}

export async function buildBabelTransaction(params: BabelTxParams): Promise<string> {
    const lucid = await getLucid();

    // Fetch the user's UTxOs directly from Blockfrost so we don't have to serialize BigInts over HTTP!
    const userUtxos = await lucid.utxosAt(params.senderAddress);

    // The backend builds the transaction.
    const tx = await lucid.newTx()
        .collectFrom(userUtxos)
        .pay.ToAddress(params.recipientAddress, { 
            [params.sendTokenId]: BigInt(params.sendAmount) 
        })
        // Note: The user MUST have added their signature requirement implicitly by us consuming their UTxOs.
        .addSigner(params.senderAddress)
        .complete();

    // We return the unsigned CBOR back to the frontend so the user can sign it.
    return tx.toCBOR();
}

export async function submitBabelTransaction(signedTxCbor: string): Promise<string> {
    const lucid = await getLucid();

    // Reconstruct the transaction from the CBOR that the user partially signed
    const tx = lucid.fromTx(signedTxCbor);
    
    // The Relayer co-signs the transaction to authorize the spending of its ADA UTxOs
    const signedTx = await tx.sign.withWallet().complete();

    // Submit to the network
    const txHash = await signedTx.submit();
    
    return txHash;
}
