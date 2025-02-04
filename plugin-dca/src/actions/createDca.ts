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

import { createDcaProvider } from "../providers/createDcaProvider.ts";


const createDcaAction: Action = {
    name: "CREATE_DCA_ORDER",
    similes: ["SETUP_DCA", "START_DCA", "CREATE_DCA"],
    description: "Creates a new Dollar Cost Averaging (DCA) order for automated trading",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        const hasCoinAmount = /\d+(\.\d+)?\s*(sui|usdc|eth)/i.test(text);
        const hasTradeCount = /\d+\s*(trades|orders)/i.test(text);
        return hasCoinAmount && hasTradeCount;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CREATE_DCA_ORDER handler...");

        try {
            const text = message.content.text?.toLowerCase() || '';
            
            const amountMatch = text.match(/(\d+(\.\d+)?)\s*(sui|usdc|eth)/i);
            const amount = amountMatch ? parseFloat(amountMatch[1]) : 10;
            
            const tradesMatch = text.match(/(\d+)\s*(trades|orders)/i);
            const trades = tradesMatch ? parseInt(tradesMatch[1]) : 5;

            state.allocateCoinAmount = BigInt(amount * 1e9);
            state.tradesAmount = trades;
            
            const result = await createDcaProvider.get(runtime, message, state);

            if (callback) {
                callback({
                    text: result,
                    content: { status: "dca_order_created" }
                });
            }

            return true;

        } catch (error) {
            console.error("Error creating DCA order:", error);
            if (callback) {
                callback({
                    text: `Error creating DCA order: ${error.message}`,
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
                    text: "Create a DCA order for 10 SUI split into 5 trades",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Setting up your DCA order...",
                    action: "CREATE_DCA_ORDER",
                },
            },
        ],
    ],
};

export default createDcaAction;