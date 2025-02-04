// src/actions/createAccount.ts
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

import { createAccountProvider } from "../providers/createAccountProvider.ts";

export default {
    name: "CREATE_ACCOUNT",
    similes: ["SETUP_ACCOUNT", "START_ACCOUNT", "CREATE_DCA_ACCOUNT"],
    description: "Creates a new DCA account for automated trading on Aftermath Finance",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating account creation request from user:", message.userId);
        
        const text = message.content.text?.toLowerCase() || '';
        const isCreateAccountRequest = text.includes('create account') || 
                                    text.includes('setup account') || 
                                    text.includes('start dca');

        console.log("Is valid create account request:", isCreateAccountRequest);
        return isCreateAccountRequest;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting CREATE_ACCOUNT handler...");

        try {
            // Get account creation result from provider
            const result = await createAccountProvider.get(runtime, message, state);
            console.log("Account creation result:", result);

            if (callback) {
                const response = {
                    text: result,
                    content: { 
                        status: result.includes("successfully") ? "account_created" : "account_creation_failed",
                        walletAddress: state.walletAddress
                    }
                };
                callback(response);
            }

            return result.includes("successfully");

        } catch (error) {
            console.error("Error in CREATE_ACCOUNT action:", error.stack || error);
            if (callback) {
                callback({
                    text: `Failed to create DCA account: ${error.message || "Unknown error"}`,
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
                    text: "Create a DCA account for automated trading",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll help you set up your DCA account right away...",
                    action: "CREATE_ACCOUNT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Setup my account for DCA trading on Aftermath",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Creating your DCA account on Aftermath Finance...",
                    action: "CREATE_ACCOUNT",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;