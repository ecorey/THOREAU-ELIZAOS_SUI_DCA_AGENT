import {
  ActionExample,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  elizaLogger,
  Action,
} from "@elizaos/core";
import { dcaProvider } from "../providers/dcaProvider.ts";

export default {
  name: "CREATE_DCA_ORDER",
  description: "Create a Dollar-Cost Averaging (DCA) order on Aftermath",

  // 1) Force this action to ALWAYS run for every incoming message:
  validate: async (_runtime: IAgentRuntime, _message: Memory) => {
    return true; // <---- changed from your old text-check to just `true`
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state,
    _options: {},
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("Starting CREATE_DCA_ORDER handler...");

    try {
      // 2) Set up the user’s Aftermath account
      const setupResult = await dcaProvider.get(runtime, message, state);
      if (!setupResult.startsWith("SUCCESS")) {
        throw new Error("Failed to set up Aftermath account");
      }

      // 3) Actually create the DCA order with your existing parameters
      const dcaResult = await dcaProvider.createDcaOrder(runtime, message, state);

      // Return text back to user
      if (callback) {
        callback({
          text: dcaResult.startsWith("SUCCESS")
            ? `✅ ${dcaResult}`
            : `❌ DCA Order Creation Failed: ${dcaResult}`,
          content: {
            status: dcaResult.startsWith("SUCCESS") ? "ok" : "error"
          },
        });
      }

      // Indicate success/fail
      return dcaResult.startsWith("SUCCESS");
    } catch (error: any) {
      console.error("Error during DCA order creation:", error);

      if (callback) {
        callback({
          text: `❌ DCA order creation failed: ${error.message}`,
          content: {
            error: error.message,
            details: {
              name: error.name,
              stack: error.stack
            }
          },
        });
      }

      return false;
    }
  },

  // Original examples are unchanged (you can keep or remove them)
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Create a DCA order to buy USDC" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "✅ DCA Order created",
          action: "CREATE_DCA_ORDER"
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Set up my DCA investment" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "✅ DCA Order created",
          action: "CREATE_DCA_ORDER"
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
