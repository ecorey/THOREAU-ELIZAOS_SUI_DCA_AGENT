
import {
  ActionExample,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  elizaLogger,
  Action,
} from "@elizaos/core";
import { dcaCancelProvider } from "../providers/dcaCancelProvider.ts";

export default {
  name: "CANCEL_DCA_ORDER",
  description: "Cancels a DCA order by ID (like 0x...)",
  
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text ?? "").toLowerCase();
    return text.includes("cancel dca") && text.includes("0x");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state,
    _options: {},
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("[CANCEL_DCA_ORDER] Handler triggered...");

    const result = await dcaCancelProvider.cancelDcaOrder(runtime, message, state);

    // creates memory for the result
    const newMemoryCancelData: Memory = {
      userId: message.userId,
      agentId: message.agentId,
      roomId: message.roomId,
      content: {
          text: result,
          action: "CANCEL_DCA_ORDER",
          source: message.content?.source,
      },
    };

    callback(newMemoryCancelData.content);



    if (callback) {
      if (result.startsWith("ERROR")) {
        callback({
          text: `❌ Could not cancel DCA order: ${result}`,
          content: { error: result },
        });
      } else {
        callback({
          text: `✅ Successfully canceled DCA order:\n${result}`,
          content: { result },
        });
      }
    }

    return !result.startsWith("ERROR");
  },

  examples: [
    [
      {
        user: "Alice",
        content: { text: "Cancel DCA order 0xf6d51dbe8a028542..." },
      },
      {
        user: "Eliza",
        content: {
          text: "✅ Successfully canceled DCA order:\nSUCCESS: DCA order 0xf6d51dbe8a028542 canceled.",
          action: "CANCEL_DCA_ORDER",
        },
      },
    ],
  ] as ActionExample[][],
} as Action;
