import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import fetch from "node-fetch"; // Ensure this polyfill is installed: `pnpm add node-fetch`

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com/latest/dex/pairs/sui/";

const dexscreenerProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        try {
            // Extract contract address from state or message content
            const contractAddress = state?.contractAddress || message?.content?.contractAddress || message?.content?.text?.match(/0x[a-fA-F0-9]{64}/)?.[0];
            console.log("Contract Address Received:", contractAddress);

            if (!contractAddress) {
                return "No contract address provided for fetching pair data.";
            }

            // Validate contract address format
            const isValidContractAddress = typeof contractAddress === "string" && /^0x[a-fA-F0-9]{64}$/.test(contractAddress);
            if (!isValidContractAddress) {
                return `Invalid contract address format: ${contractAddress}`;
            }

            // Construct API request URL
            const apiUrl = `${DEXSCREENER_BASE_URL}/${contractAddress}`;
            console.log(`Fetching data from DexScreener API: ${apiUrl}`);

            // Fetch data from the DexScreener API
            const response = await fetch(apiUrl);
            console.log("DexScreener API Response Status:", response.status);

            if (!response.ok) {
                return `DexScreener API returned an error: ${response.statusText}`;
            }

            const data = await response.json() as { pairs: any[] };
            console.log("DexScreener API Response Data:", data);

            // Ensure pairs field exists in response
            if (!data.pairs || data.pairs.length === 0) {
                return `No data available for the contract address: ${contractAddress}.`;
            }

            const pair = data.pairs[0];
            const {
                baseToken, quoteToken, priceNative, priceUsd, txns, volume,
                priceChange, liquidity, fdv, marketCap, pairCreatedAt, info,
            } = pair;

            // Format the output
            const output = `
${runtime.character.name} Pair Analysis:
Base Token: ${baseToken.name} (${baseToken.symbol})
Base Token Address: ${baseToken.address}
Quote Token: ${quoteToken.name} (${quoteToken.symbol})
Quote Token Address: ${quoteToken.address}
Price (Native): ${priceNative}
Price (USD): $${priceUsd || "N/A"}
Liquidity (USD): $${liquidity.usd.toLocaleString() || "N/A"}
Pooled ${baseToken.symbol}: ${liquidity.base.toLocaleString() || "N/A"}
Pooled ${quoteToken.symbol}: ${liquidity.quote.toLocaleString() || "N/A"}
24h Volume: $${volume.h24.toLocaleString() || "N/A"}
Transactions (Last 24h): Buys: ${txns.h24.buys || 0}, Sells: ${txns.h24.sells || 0}
Price Change (24h): ${priceChange.h24 || 0}%
FDV: $${fdv.toLocaleString() || "N/A"}
Market Cap: $${marketCap.toLocaleString() || "N/A"}
Pair Created At: ${new Date(pairCreatedAt).toLocaleString()}
DEX URL: ${pair.url}

Additional Information:
Image URL: ${info?.imageUrl || "N/A"}
Website: ${info?.websites?.[0]?.url || "N/A"}
Twitter: ${info?.socials?.find(social => social.type === "twitter")?.url || "N/A"}
`;

            console.log("Formatted Output:", output);

            return output;
        } catch (error) {
            // Log detailed error for debugging
            console.error("DexScreener Provider Error:", error.stack || error);
            return `Error fetching pair data: ${error.message || "Unknown error"}`;
        }
    },
};

export { dexscreenerProvider };
