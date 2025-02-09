import { IAgentRuntime, Memory, Action, HandlerCallback } from "@elizaos/core";
import {
  EggCheckByAddressState,
  checkEggOwnershipByAddressProvider,
} from "../providers/eggCheckByAddressProvider.ts";

export default {
  name: "CHECK_ADDRESS_EGG_OWNERSHIP",
  similes: ["CHECK_ADDRESS_AF_EGG", "VERIFY_ADDRESS_EGG", "CHECK_WALLET_EGG"],
  description: "Check if the kiosk (passed in) has an AF egg, return kiosk's 'owner' field.",

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    // Very simple: Must have a 0x... ID and the phrase "egg" or "af"
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
      console.log("Processing kiosk egg check text:", text);

      // Extract kiosk ID
      const kioskMatch = text.match(/0x[a-fA-F0-9]{64}/);
      if (!kioskMatch) {
        if (callback) {
          callback({
            text: "Please provide a valid kiosk ID (0x...)",
            content: { status: "missing_kiosk_id" },
          });
        }
        return false;
      }

      // We'll store kiosk ID in 'address'
      state.address = kioskMatch[0];

      // Call the provider
      const resultStr = await checkEggOwnershipByAddressProvider.get(
        runtime,
        message,
        state
      );
      const parsed = JSON.parse(resultStr);

      let responseText: string;
      if (!parsed.success) {
        responseText = `Error checking kiosk: ${parsed.error}`;
      } else {
        // Summarize
        if (parsed.hasEgg) {
          responseText = `Kiosk ${parsed.kioskId} **DOES** contain an AfEgg.\nMove-struct owner field: ${parsed.kioskOwnerField}\nSui owner: ${JSON.stringify(parsed.kioskSuiOwner)}`;
        } else {
          responseText = `Kiosk ${parsed.kioskId} does NOT contain an AfEgg.\nMove-struct owner field: ${parsed.kioskOwnerField}\nSui owner: ${JSON.stringify(parsed.kioskSuiOwner)}`;
        }
      }

      if (callback) {
        callback({
          text: responseText,
          content: {
            status: parsed.success ? "success" : "error",
            result: parsed,
          },
        });
      }
      return true;

    } catch (error: any) {
      console.error("Kiosk Egg Check Action Error:", error);
      if (callback) {
        callback({
          text: `Error checking kiosk: ${error.message || "Unknown error"}`,
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
          text: "Check if 0x372247ec1305bf1ade33fb4aca2a9de489ec0f44a9b8a65f4c79c90cec2f5772 has an AF egg",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Kiosk 0x3722... does contain an AfEgg. Owner: 0xbadd6ced76a9...",
          action: "CHECK_ADDRESS_EGG_OWNERSHIP",
        },
      },
    ],
  ],
} as Action;
