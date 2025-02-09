
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
  description: "Create a DCA order by building + broadcasting the transaction",

  // For testing, always trigger:
  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state,
    _options,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("[CREATE_DCA_ORDER] Handler triggered...");

    try {
      // 1) Setup DCA
      const setupResult = await dcaProvider.get(runtime, message, state);
      if (!setupResult.startsWith("SUCCESS")) {
        throw new Error(setupResult);
      }

      // 2) Create + broadcast
      const dcaResult = await dcaProvider.createDcaOrder(runtime, message, state);

      if (callback) {
        if (dcaResult.startsWith("SUCCESS")) {
          callback({
            text: `✅ ${dcaResult}`,
            content: { status: "ok" },
          });
        } else {
          callback({
            text: `❌ DCA Order Creation Failed: ${dcaResult}`,
            content: { error: dcaResult },
          });
        }
      }

      return dcaResult.startsWith("SUCCESS");
    } catch (error: any) {
      elizaLogger.error("[CREATE_DCA_ORDER] error:", error);
      if (callback) {
        callback({
          text: `❌ DCA order creation error: ${error.message}`,
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
        content: { text: "Create a DCA order to buy USDC" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "✅ DCA Order created",
          action: "CREATE_DCA_ORDER",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
