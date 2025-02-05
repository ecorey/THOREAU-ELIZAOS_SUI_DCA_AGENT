// createAccount.ts
import {
    Action, 
    ActionExample,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { createAccountProvider } from "../providers/createAccountProvider.ts";

const createAccountAction =  {
    name: "CREATE_ACCOUNT",
    similes: ["SETUP_ACCOUNT", "START_ACCOUNT"],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return text.includes('create account') || text.includes('setup account');
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            const result = await createAccountProvider.get(runtime, message, state);
            
            let responseText;
            switch(result) {
                case "SUCCESS":
                    responseText = "Successfully created your DCA account";
                    break;
                case "EXISTS":
                    responseText = "DCA account already exists";
                    break;
                case "FAILED":
                    responseText = "Failed to create DCA account";
                    break;
                default:
                    responseText = `Error: ${result.replace('ERROR:', '')}`;
            }

            if (callback) {
                callback({
                    text: responseText,
                    content: { status: result }
                });
            }

            return result === "SUCCESS";

        } catch (error) {
            if (callback) {
                callback({
                    text: `Error: ${error.message}`,
                    content: { error: error.message }
                });
            }
            return false;
        }
    },

    examples: [[
        {
            user: "{{user1}}",
            content: { text: "Create a DCA account" }
        },
        {
            user: "{{user2}}",
            content: { text: "Setting up your DCA account...", action: "CREATE_ACCOUNT" }
        }
    ]] as ActionExample[][]
} as Action;

export default createAccountAction;
