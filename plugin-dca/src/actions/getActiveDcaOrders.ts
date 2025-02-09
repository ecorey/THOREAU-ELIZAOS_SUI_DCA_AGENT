
import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    elizaLogger,
    Action,
  } from "@elizaos/core";
  import { dcaActiveOrdersProvider } from "../providers/dcaActiveOrdersProvider.ts";
  
  export default {
    name: "GET_ACTIVE_DCA_ORDERS",
    description: "Fetch the user's ACTIVE DCA orders only",
  
    /**
     * We'll trigger if user says e.g. "show active orders" or "check active dca"
     */
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
      const text = (message.content.text || "").toLowerCase();
      return (
        text.includes("active dca") ||
        text.includes("active orders") ||
        text.includes("show active dca")
      );
    },
  
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state,
      _options: {},
      callback?: HandlerCallback
    ): Promise<boolean> => {
      elizaLogger.log("[GET_ACTIVE_DCA_ORDERS] Handler triggered...");
  
      // 1) Call the new provider's method
      const result = await dcaActiveOrdersProvider.getActiveOrders(
        runtime,
        message,
        state
      );
  
      // 2) Provide output
      if (callback) {
        if (result.startsWith("ERROR")) {
          callback({
            text: `❌ Could not retrieve active DCA orders: ${result}`,
            content: { error: result },
          });
        } else {
          callback({
            text: `✅ Your ACTIVE DCA orders:\n${result}`,
            content: { orders: result },
          });
        }
      }
  
      return !result.startsWith("ERROR");
    },
  
    examples: [
      [
        {
          user: "{{user1}}",
          content: { text: "Show my active DCA orders" },
        },
        {
          user: "{{user2}}",
          content: {
            text: "✅ Your ACTIVE DCA orders:\n ...",
            action: "GET_ACTIVE_DCA_ORDERS",
          },
        },
      ],
      [
        {
          user: "{{user1}}",
          content: { text: "Check my active DCA" },
        },
        {
          user: "{{user2}}",
          content: {
            text: "✅ Your ACTIVE DCA orders:\n ...",
            action: "GET_ACTIVE_DCA_ORDERS",
          },
        },
      ],
    ] as ActionExample[][],
  } as Action;
  