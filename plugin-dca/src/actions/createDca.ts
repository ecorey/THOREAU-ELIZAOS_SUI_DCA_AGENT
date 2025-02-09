import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    elizaLogger,
    type Action
} from "@elizaos/core";
import { dcaProvider, DCAState } from "../providers/dcaProvider.ts";

function parseDCAParams(message: Memory): Record<string, any> {
    const text = message.content.text?.toLowerCase() || '';
    const params: Record<string, any> = {};

    console.log("📩 Raw message text:", text);

    // Parse USDC amount if specified (e.g., "10 USDC")
    const usdcMatch = text.match(/(\d+\.?\d*)\s*usdc/i);
    if (usdcMatch) {
        const amount = parseFloat(usdcMatch[1]);
        console.log("🔹 Parsed USDC amount:", amount);

        if (isNaN(amount) || amount <= 0) {
            throw new Error("Invalid USDC amount. Ensure it's a valid number.");
        }

        params.allocateCoinAmount = BigInt(Math.round(amount * 1_000_000));
    } else {
        throw new Error("❌ No USDC amount found in message.");
    }

    // Validate before returning
    if (!params.allocateCoinAmount || params.allocateCoinAmount <= BigInt(0)) {
        throw new Error("Invalid allocateCoinAmount! Check that it's a proper BigInt.");
    }

    console.log("✅ Final Parsed DCA Parameters:", params);

    return {
        allocateCoinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        allocateCoinAmount: params.allocateCoinAmount,
        buyCoinType: "0x2::sui::SUI",
        frequencyMs: 3600000,
        tradesAmount: 2
    };
}


export default {
    name: "CREATE_DCA",
    description: "Sets up DCA (Dollar Cost Averaging) to buy SUI using USDC on Aftermath Finance.",

    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating DCA setup request from user:", message.userId);
        return /dca/i.test(message.content.text || '') && /sui/i.test(message.content.text || '') && /usdc/i.test(message.content.text || '');
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state: DCAState, _options: {}, callback?: HandlerCallback): Promise<boolean> => {
        elizaLogger.log("Starting CREATE_DCA handler...");

        try {
            if (!state.walletAddress) {
                console.log("Aftermath SDK not initialized. Initializing now...");
                await dcaProvider.get(runtime, message, state);
            }

            const aftermath = (state as any).aftermath;
            if (!aftermath || !aftermath.dca) {
                throw new Error("Failed to retrieve Aftermath DCA API instance.");
            }

            const params = parseDCAParams(message);
            const perTradeAmount = params.allocateCoinAmount / BigInt(params.tradesAmount);

            if (perTradeAmount <= BigInt(0)) {
                throw new Error("Invalid per-trade allocation.");
            }

            const orderTx = await aftermath.dca.getCreateDcaOrderTx({
                walletAddress: state.walletAddress!,
                allocateCoinType: params.allocateCoinType,
                allocateCoinAmount: params.allocateCoinAmount,
                buyCoinType: params.buyCoinType,
                frequencyMs: params.frequencyMs,
                tradesAmount: params.tradesAmount,
                delayTimeMs: 0,
                maxAllowableSlippageBps: 250,
                coinPerTradeAmount: perTradeAmount
            });

            console.log("✓ DCA order created:", orderTx);
            return true;
        } catch (error) {
            console.error("Error during DCA setup:", error);
            return false;
        }
    }
} as Action;
