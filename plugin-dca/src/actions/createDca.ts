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
  name: "AFTERMATH_SETUP",
  description: "Connect to Aftermath and create user account if not found",

  // Validate based on various trigger phrases
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    return (
      text.includes("aftermath") || 
      text.includes("af setup") || 
      text.includes("dca setup") || 
      text.includes("initialize wallet")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state,
    _options: {},
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("Starting AFTERMATH_SETUP handler...");

    try {
      const result = await dcaProvider.get(runtime, message, state);
      
      if (callback) {
        callback({
          text: result.startsWith("SUCCESS") 
            ? `✅ ${result}` 
            : `❌ Setup Failed: ${result}`,
          content: { 
            status: result.startsWith("SUCCESS") ? "ok" : "error" 
          },
        });
      }

      return result.startsWith("SUCCESS");
    } catch (error: any) {
      console.error("Error during Aftermath setup:", error);
      
      if (callback) {
        callback({
          text: `❌ Aftermath setup failed: ${error.message}`,
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

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Can you set up my Aftermath wallet?" },
      },
      {
        user: "{{user2}}",
        content: { 
          text: "✅ Aftermath account setup complete", 
          action: "AFTERMATH_SETUP" 
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Initialize my DCA wallet" },
      },
      {
        user: "{{user2}}",
        content: { 
          text: "✅ Aftermath account setup complete", 
          action: "AFTERMATH_SETUP" 
        },
      },
    ],
  ] as ActionExample[][],
} as Action;