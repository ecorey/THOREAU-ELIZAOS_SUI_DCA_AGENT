import 'dotenv/config';
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@firefly-exchange/library-sui";
import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot/query-chain.js";

interface PoolInfo {
    id: string;
    name: string;
    fee_rate: number;
    coin_a: {
        address: string;
        balance: string;
        decimals: number;
    };
    coin_b: {
        address: string;
        balance: string;
        decimals: number;
    };
    current_sqrt_price: string;
    current_tick: number;
    liquidity: string;
    is_paused: boolean;
}

let client: SuiClient;
try {
    client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
    });
} catch (error) {
    console.error("Error initializing SuiClient:", error);
}

async function getPool(poolID: string): Promise<PoolInfo> {
    if (!client) {
        throw new Error("SuiClient failed to initialize");
    }
    try {
        let qc = new QueryChain(client);
        let pool = await qc.getPool(poolID);
        return pool as PoolInfo;
    } catch (error) {
        console.error("Error in getPool:", error);
        throw error;
    }
}

export const bluefinDataProvider: Provider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if (!client) {
            return "Error: Unable to connect to Sui network";
        }

        const poolID = (state?.poolID || message?.content?.poolID) as string;

        if (!poolID) {
            return "No pool ID provided. Please specify a valid Bluefin pool ID.";
        }

        try {
            const poolInfo = await getPool(poolID);

            const formattedInfo = {
                id: poolInfo.id,
                name: poolInfo.name,
                feeRate: poolInfo.fee_rate,
                coinA: {
                    address: poolInfo.coin_a.address,
                    balance: poolInfo.coin_a.balance,
                    decimals: poolInfo.coin_a.decimals
                },
                coinB: {
                    address: poolInfo.coin_b.address,
                    balance: poolInfo.coin_b.balance,
                    decimals: poolInfo.coin_b.decimals
                },
                currentSqrtPrice: poolInfo.current_sqrt_price,
                currentTick: poolInfo.current_tick,
                liquidity: poolInfo.liquidity,
                isPaused: poolInfo.is_paused
            };

            return `Bluefin Pool Info for ${poolID}:\n${JSON.stringify(formattedInfo, null, 2)}`;
        } catch (error) {
            console.error("Bluefin Data Provider Error:", error);
            return `Error processing request: ${(error as Error).message || 'Unknown error'}`;
        }
    },
};