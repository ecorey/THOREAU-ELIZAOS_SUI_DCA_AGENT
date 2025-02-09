import { IAgentRuntime, Memory, Action, HandlerCallback } from "@elizaos/core";
import { eggOwnershipProvider, EggCheckState } from "../providers/eggCheckProvider.ts";

export default {
  name: "CHECK_EGG_OWNERSHIP",
  similes: ["CHECK_AF_EGG", "VERIFY_EGG_OWNERSHIP", "DO_I_HAVE_AF_EGG"],
  description: "Check if the user owns an AF egg NFT",
  
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    // Only check for egg-related keywords since we don't need wallet address
    return /egg/i.test(text) || /af/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: EggCheckState,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    try {
      console.log("Processing egg ownership check");
      
      const result = await eggOwnershipProvider.get(runtime, message, state);
      console.log("Egg ownership check result:", result);

      const parsedResult = JSON.parse(result);
      let responseText = parsedResult.success
        ? parsedResult.ownsEgg 
          ? `You own ${parsedResult.count} AF egg(s)!` 
          : "You don't own any AF eggs yet."
        : `Error checking egg ownership: ${parsedResult.error}`;

      if (callback) {
        callback({
          text: responseText,
          content: { status: parsedResult.success ? "success" : "error" }
        });
      }
      
      return true;

    } catch (error: any) {
      console.error("Egg Ownership Check Action Error:", error);
      if (callback) {
        callback({
          text: `Error checking egg ownership: ${error.message || "Unknown error"}`,
          content: { error: error.message }
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
          text: "Do I have any AF eggs?",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Checking your egg ownership...",
          action: "CHECK_EGG_OWNERSHIP",
        },
      },
    ],
  ],
} as Action;