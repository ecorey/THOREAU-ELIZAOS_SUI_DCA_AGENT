import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Aftermath } from "aftermath-ts-sdk";

interface DCAOrderParams {
    walletAddress: string; 
    allocateCoinType: string;
    allocateCoinAmount: bigint;
    buyCoinType: string;
    frequencyMs: number;
    tradesAmount: number;
    delayTimeMs: number;
    maxAllowableSlippageBps: number;
    coinPerTradeAmount: bigint;
    customRecipient?: string;
    strategy?: {
        minPrice: bigint;
        maxPrice: bigint;
    };
    integratorFee?: {
        feeBps: number;
        feeRecipient: string;
    };
    isSponsoredTx?: boolean;
}

// Initialize Sui client at the top level
let suiClient: SuiClient;
try {
    suiClient = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443"
    });
} catch (error) {
    console.error("Error initializing SuiClient:", error);
}

const createDcaProvider = {
    get: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<string> => {
        if (!suiClient) {
            return "Error: Unable to connect to Sui network";
        }

        try {
            // Initialize Aftermath SDK
            const afSdk = new Aftermath("MAINNET");
            await afSdk.init();
            const dca = afSdk.Dca();

            // Get wallet details from runtime settings
            const privateKey = runtime.getSetting("SUI_PRIVATE_KEY");
            const suiAccount = Ed25519Keypair.deriveKeypair(privateKey);
            const walletAddress = suiAccount.toSuiAddress();

            // Rest of your implementation remains the same
            const dcaParams: DCAOrderParams = {
                walletAddress, 
                allocateCoinType: (state?.allocateCoinType as string) || "0x2::sui::SUI",
                allocateCoinAmount: BigInt(Number(state?.allocateCoinAmount) || 10_000_000_000),
                buyCoinType: state?.buyCoinType as string,
                frequencyMs: Number(state?.frequencyMs) || 60000,
                tradesAmount: Number(state?.tradesAmount) || 5,
                delayTimeMs: Number(state?.delayTimeMs) || 0,
                maxAllowableSlippageBps: Number(state?.maxAllowableSlippageBps) || 100,
                coinPerTradeAmount: BigInt(Number(state?.coinPerTradeAmount) || 2_000_000_000),
                customRecipient: state?.customRecipient as string,
                strategy: state?.strategy && typeof state.strategy === 'object' ? {
                    minPrice: BigInt((state.strategy as { minPrice: number }).minPrice),
                    maxPrice: BigInt((state.strategy as { maxPrice: number }).maxPrice)
                } : undefined,
                integratorFee: state?.integratorFee && typeof state.integratorFee === 'object' ? {
                    feeBps: Number((state.integratorFee as { feeBps: number }).feeBps),
                    feeRecipient: (state.integratorFee as { feeRecipient: string }).feeRecipient
                } : undefined,
                isSponsoredTx: Boolean(state?.isSponsoredTx) || false
            };

            // Create DCA order transaction
            const tx = await dca.getCreateDcaOrderTx(dcaParams);

            return `${runtime.character.name} DCA Analysis:
                Transaction Details
                ------------------
                Type: Dollar Cost Averaging (DCA)
                Status: Created Successfully
                Wallet: ${walletAddress}

                Investment Parameters
                -------------------
                Total: ${Number(dcaParams.allocateCoinAmount) / 1e9} SUI
                Trades: ${dcaParams.tradesAmount}
                Frequency: ${dcaParams.frequencyMs / 1000} seconds
                Per Trade: ${Number(dcaParams.coinPerTradeAmount) / 1e9} SUI
                Max Slippage: ${dcaParams.maxAllowableSlippageBps / 100}%

                Token Information
                ---------------
                Input: ${dcaParams.allocateCoinType}
                Output: ${dcaParams.buyCoinType}

                Strategy
                ---------------
                Min Price: ${dcaParams.strategy ? Number(dcaParams.strategy.minPrice) / 1e6 : 'Not Set'} USDC
                Max Price: ${dcaParams.strategy ? Number(dcaParams.strategy.maxPrice) / 1e6 : 'Not Set'} USDC

                Transaction
                --------------------
                Details: ${JSON.stringify(tx)}
                Network: MAINNET`;

        } catch (error) {
            console.error("DCA Provider Error:", error);
            return `Error creating DCA order: ${error.message}`;
        }
    }
} satisfies Provider;

export { createDcaProvider, type DCAOrderParams };