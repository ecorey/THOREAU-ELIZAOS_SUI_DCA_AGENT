import { IAgentRuntime, Memory, Action, HandlerCallback } from "@elizaos/core";
import {
  EggCheckByAddressState,
  checkEggOwnershipByAddressProvider
} from "../providers/eggCheckByAddressProvider.ts";

export default {
  name: "CHECK_ADDRESS_EGG_OWNERSHIP",
  similes: ["CHECK_ADDRESS_AF_EGG", "VERIFY_ADDRESS_EGG", "CHECK_WALLET_EGG"],
  description: "Check if a kiosk has an AF egg and if the local wallet is the kiosk owner",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    return (
      /0x[a-fA-F0-9]{64}/.test(text) &&
      (text.includes("egg") || text.includes("af"))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: EggCheckByAddressState,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    try {
      const text = message.content.text || "";
      const kioskMatch = text.match(/0x[a-fA-F0-9]{64}/);
      if (!kioskMatch) {
        if (callback) {
          callback({
            text: "Please provide a valid kiosk ID (0x...)",
            content: { status: "missing_kiosk_id" }
          });
        }
        return false;
      }

      state.address = kioskMatch[0]; // kioskId
      console.log("Checking kiosk ID:", state.address);

      // Call your existing provider
      const resultStr = await checkEggOwnershipByAddressProvider.get(runtime, message, state);
      const parsed = JSON.parse(resultStr);

      let responseText: string;
      if (!parsed.success) {
        responseText = `Error checking kiosk: ${parsed.error}`;
      } else {
        // Minimal response logic
        const hasEgg = parsed.hasEgg;
        const isOwner = parsed.isOwner;
        if (hasEgg) {
          responseText = "Yes, the kiosk has an egg!\n";
        } else {
          responseText = "No egg in the kiosk.\n";
        }
        if (isOwner) {
          responseText += "You ARE the owner! Congratulations!!!";
        } else {
          responseText += "You are NOT the owner. Sorry!";
        }
      }

      if (callback) {
        callback({
          text: responseText,
          content: {
            status: parsed.success ? "success" : "error",
            result: parsed
          }
        });
      }
      return true;

    } catch (error: any) {
      console.error("Kiosk Egg Check Action Error:", error);
      if (callback) {
        callback({
          text: `Error checking kiosk: ${error.message || "Unknown error"}`,
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
          text: "Check if 0x372247ec1305bf1ade33fb4aca2a9de489ec0f44a9b8a65f4c79c90cec2f5772 owns an AF egg"
        }
      },
      {
        user: "{{user2}}",
        content: {
          text: "Yes, the kiosk has an egg!\nYou are NOT the owner. Sorry!",
          action: "CHECK_ADDRESS_EGG_OWNERSHIP"
        }
      }
    ]
  ]
} as Action;
