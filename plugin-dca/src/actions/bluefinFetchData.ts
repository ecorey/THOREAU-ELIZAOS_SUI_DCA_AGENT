import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
} from "@elizaos/core";
import { bluefinDataProvider } from "../providers/bluefinDataProvider.ts";

export default {
    name: "FETCH_BLUEFIN_DATA",
    similes: ["GET_POOL_INFO", "CHECK_BLUEFIN_POOL", "BLUEFIN_POOL_DATA", "GET_BLUEFIN_INFO"],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return /bluefin|pool|0x[a-fA-F0-9]{64}/i.test(text);
    },

    description: "Fetch Bluefin pool information using a Sui pool contract address.",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const text = message.content.text?.toLowerCase() || '';
            console.log("Processing text:", text);

            const poolIDMatch = text.match(/0x[a-fA-F0-9]{64}/);
            console.log("Pool ID match:", poolIDMatch);

            let poolID = poolIDMatch ? poolIDMatch[0] : null;

            if (!poolID) {
                const response = "Please provide a valid Sui contract address for the Bluefin pool (starts with 0x followed by 64 hexadecimal characters).";
                console.log("No pool ID found:", response);
                if (callback) {
                    callback({
                        text: response,
                        content: { status: "missing_pool_id" },
                    });
                }
                return false;
            }

            console.log("Using pool ID:", poolID);
            state.poolID = poolID;

            console.log("Calling bluefinDataProvider.get...");
            const result = await bluefinDataProvider.get(runtime, message, state);
            console.log("Provider result:", result);

            if (callback) {
                callback({
                    text: result,
                    content: { status: "success" },
                });
            }

            return true;
        } catch (error) {
            console.error("Detailed Bluefin Data Action Error:", {
                error,
                message: error.message,
                stack: error.stack
            });
            if (callback) {
                callback({
                    text: `Error accessing Bluefin pool data: ${error.message || 'Unknown error'}`,
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
                    text: "Get Bluefin pool info for 0xde705d4f3ded922b729d9b923be08e1391dd4caeff8496326123934d0fb1c312",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Fetching pool data from Bluefin...",
                    action: "FETCH_BLUEFIN_DATA",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Check this Bluefin contract 0xde705d4f3ded922b729d9b923be08e1391dd4caeff8496326123934d0fb1c312",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Getting Bluefin pool information...",
                    action: "FETCH_BLUEFIN_DATA",
                },
            },
        ]
    ],
} as Action;