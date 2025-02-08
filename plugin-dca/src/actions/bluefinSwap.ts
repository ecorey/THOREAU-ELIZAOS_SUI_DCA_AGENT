import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@elizaos/core";
import { bluefinSwapProvider } from "../providers/bluefinSwapProvider.ts";

interface SwapState extends State {
    poolID?: string;
    amount?: number;
    aToB?: boolean;
    byAmountIn?: boolean;
    slippage?: number;
}

export default {
    name: "BLUEFIN_SWAP",
    similes: ["SWAP_ON_BLUEFIN", "EXECUTE_BLUEFIN_SWAP", "TRADE_ON_BLUEFIN"],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return /bluefin|swap|0x[a-fA-F0-9]{64}/i.test(text);
    },

    description: "Execute a swap on Bluefin using a pool contract address",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: SwapState,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const text = message.content.text?.toLowerCase() || '';
            console.log("Processing swap text:", text);

            // Extract pool ID
            const poolIDMatch = text.match(/0x[a-fA-F0-9]{64}/);
            console.log("Pool ID match:", poolIDMatch);

            let poolID = poolIDMatch ? poolIDMatch[0] : null;

            if (!poolID) {
                const response = "Please provide a valid Bluefin pool contract address (starts with 0x followed by 64 hexadecimal characters).";
                console.log("No pool ID found:", response);
                if (callback) {
                    callback({
                        text: response,
                        content: { status: "missing_pool_id" },
                    });
                }
                return false;
            }

            // Extract amount - look for a number before any word boundary
            const amountMatch = text.match(/(\d+\.?\d*)/);
            if (!amountMatch) {
                if (callback) {
                    callback({
                        text: "Please specify an amount for the swap.",
                        content: { status: "missing_amount" },
                    });
                }
                return false;
            }

            const amount = parseFloat(amountMatch[1]);

            // Set swap direction (default is A to B unless "reverse" is specified)
            const aToB = !text.includes("reverse");

            // Set amount direction (default is by input amount unless "output" is specified)
            const byAmountIn = !text.includes("output");

            // Extract slippage if specified (default to 0.1%)
            const slippageMatch = text.match(/slippage\s+(\d+\.?\d*)/i);
            const slippage = slippageMatch ? parseFloat(slippageMatch[1]) / 100 : 0.001;

            console.log("Executing swap with params:", {
                poolID,
                amount,
                aToB,
                byAmountIn,
                slippage
            });

            state.poolID = poolID;
            state.amount = amount;
            state.aToB = aToB;
            state.byAmountIn = byAmountIn;
            state.slippage = slippage;

            const result = await bluefinSwapProvider.get(runtime, message, state);
            console.log("Provider result:", result);

            if (callback) {
                callback({
                    text: result,
                    content: { status: "success" },
                });
            }

            return true;
        } catch (error) {
            console.error("Bluefin Swap Action Error:", error);
            if (callback) {
                callback({
                    text: `Error executing swap: ${error.message || 'Unknown error'}`,
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
                    text: "Swap 1.5 tokens on Bluefin pool 0xde705d4f3ded922b729d9b923be08e1391dd4caeff8496326123934d0fb1c312",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Processing swap...",
                    action: "BLUEFIN_SWAP",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Execute reverse swap of 2.0 with slippage 0.5 on Bluefin 0xde705d4f3ded922b729d9b923be08e1391dd4caeff8496326123934d0fb1c312",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Processing reverse swap...",
                    action: "BLUEFIN_SWAP",
                },
            },
        ]
    ],
} as Action;