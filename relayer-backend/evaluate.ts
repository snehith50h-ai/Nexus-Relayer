/**
 * Evaluates whether the offered native token fee is profitable enough
 * to cover the ADA network fee. 
 * This is where the Gemini Agent (or pricing oracle) integration lives.
 */
export async function evaluateIntent(feeOffered: string, tokenAssetId: string): Promise<boolean> {
    console.log(`Evaluating intent: Offered ${feeOffered} of ${tokenAssetId}`);
    
    // Map Policy IDs to CoinGecko IDs
    const TOKEN_MAP: Record<string, string> = {
        'lovelace': 'cardano',
        'd9312da562da182b02322fd8acb536f37eb9d29fba7c49dc172555275343524f4c4c': 'scroll', // Dummy mapping
        '279c909f348e533da58088cb3fd65494244243b6dcdd977b311fa89f534e454b': 'snek',
        'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235484f534b59': 'hosky-token'
    };

    const coingeckoId = TOKEN_MAP[tokenAssetId];
    if (!coingeckoId) {
        console.log(`Intent rejected: Unsupported token ${tokenAssetId}.`);
        return false;
    }

    try {
        console.log(`Fetching live prices from CoinGecko...`);
        // Fetch prices for Cardano and the requested fee token
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=cardano,${coingeckoId}&vs_currencies=usd`);
        const prices = await response.json();

        const adaPriceUsd = prices['cardano']?.usd || 0.40; // Fallback to 40 cents if undefined
        let tokenPriceUsd = prices[coingeckoId]?.usd;

        // Fallback for dummy tokens or if API fails to find it
        if (!tokenPriceUsd) {
            console.log(`Could not find live price for ${coingeckoId}, using fallback proxy price.`);
            tokenPriceUsd = 0.05; // Fallback proxy price
        }

        console.log(`Live Prices: ADA = $${adaPriceUsd}, ${coingeckoId} = $${tokenPriceUsd}`);

        // Calculate network cost
        const expectedNetworkFeeAda = 0.2; // roughly 0.2 ADA
        const requiredRelayerMarkup = 1.5; // Relayer wants 50% profit margin
        const costInUsd = expectedNetworkFeeAda * adaPriceUsd * requiredRelayerMarkup;

        // Calculate value of offered fee
        // Assume feeOffered is in the lowest denomination. 
        // For simplicity in this hackathon, we assume 0 decimals for the native tokens, 6 for ADA.
        let offeredAmount = Number(feeOffered);
        if (tokenAssetId === 'lovelace') {
            offeredAmount = offeredAmount / 1000000;
        }

        const offeredValueUsd = offeredAmount * tokenPriceUsd;

        console.log(`Relayer Cost: $${costInUsd.toFixed(4)}, Offered Fee Value: $${offeredValueUsd.toFixed(4)}`);

        if (offeredValueUsd >= costInUsd) {
            console.log('Intent approved by Oracle: Profitable trade.');
            return true;
        } else {
            console.log(`Intent rejected: Insufficient fee value. Offered $${offeredValueUsd.toFixed(4)}, Required $${costInUsd.toFixed(4)}.`);
            return false;
        }

    } catch (e) {
        console.error('Error fetching from CoinGecko API:', e);
        // Fallback to basic static evaluation if API is down
        console.log('Falling back to static evaluation due to API error.');
        const minFeeRequired = BigInt(50);
        return BigInt(feeOffered) >= minFeeRequired;
    }
}

export async function getRecommendedFee(tokenAssetId: string): Promise<string> {
    const TOKEN_MAP: Record<string, string> = {
        'lovelace': 'cardano',
        'd9312da562da182b02322fd8acb536f37eb9d29fba7c49dc172555275343524f4c4c': 'scroll',
        '279c909f348e533da58088cb3fd65494244243b6dcdd977b311fa89f534e454b': 'snek',
        'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235484f534b59': 'hosky-token'
    };

    const coingeckoId = TOKEN_MAP[tokenAssetId];
    if (!coingeckoId) {
        return "0";
    }

    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=cardano,${coingeckoId}&vs_currencies=usd`);
        const prices = await response.json();

        const adaPriceUsd = prices['cardano']?.usd || 0.40;
        let tokenPriceUsd = prices[coingeckoId]?.usd || 0.05;

        const expectedNetworkFeeAda = 0.2;
        const requiredRelayerMarkup = 1.5;
        const costInUsd = expectedNetworkFeeAda * adaPriceUsd * requiredRelayerMarkup;

        const recommendedTokens = costInUsd / tokenPriceUsd;

        if (tokenAssetId === 'lovelace') {
            return recommendedTokens.toFixed(2);
        } else {
            return Math.ceil(recommendedTokens).toString();
        }
    } catch (e) {
        console.error('Error fetching recommendation:', e);
        return tokenAssetId === 'lovelace' ? "1" : "50";
    }
}
