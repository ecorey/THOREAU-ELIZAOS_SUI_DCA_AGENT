import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    type Action,
} from "@elizaos/core";

import { dexscreenerProvider } from "../providers/dexscreenerProvider";

export default {
    name: "CHECK_PRICE",
    similes: ["GET_PRICE", "PRICE_CHECK", "TOKEN_PRICE"],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating price check request from user:", message.userId);

        // Check if message contains a token address (simple hex check)
        const text = message.content.text?.toLowerCase() || '';
        const hasTokenAddress = /0x[a-fA-F0-9]{40}/.test(text);

        if (!hasTokenAddress) {
            console.log("No valid token address found in message");
            return false;
        }

        return true;
    },

    description: "Check token price using DexScreener data",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CHECK_PRICE handler...");

        try {
            // Extract token address from message
            const text = message.content.text?.toLowerCase() || '';
            const tokenAddressMatch = text.match(/0x[a-fA-F0-9]{40}/);

            if (!tokenAddressMatch) {
                if (callback) {
                    callback({
                        text: "Please provide a valid token address to check the price.",
                        content: { status: "invalid_address" }
                    });
                }
                return false;
            }

            // Set token address in state for the provider
            state.tokenAddress = tokenAddressMatch[0];

            // Get price data from DexScreener
            const priceData = await dexscreenerProvider.get(runtime, message, state);

            if (callback) {
                callback({
                    text: priceData,
                    content: { status: "price_check_complete" }
                });
            }

            return true;

        } catch (error) {
            console.error("Error during price check:", error);
            if (callback) {
                callback({
                    text: `Error checking price: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the price of 0x1234567890123456789012345678901234567890?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Let me check that token price for you...",
                    action: "CHECK_PRICE",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you check the price of USDC token at 0x2791bca1f2de4661ed88a30c99a7a9449aa84174?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Checking USDC token price...",
                    action: "CHECK_PRICE",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;