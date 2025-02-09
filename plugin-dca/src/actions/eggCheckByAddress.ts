// eggCheckByAddressAction.ts
import { IAgentRuntime, Memory, Action, HandlerCallback } from "@elizaos/core";
import { EggCheckByAddressState, checkEggOwnershipByAddressProvider } from "../providers/eggCheckByAddressProvider.ts";

export default {
  name: "CHECK_ADDRESS_EGG_OWNERSHIP",
  similes: ["CHECK_ADDRESS_AF_EGG", "VERIFY_ADDRESS_EGG", "CHECK_WALLET_EGG"],
  description: "Check if a specific wallet address owns an AF egg NFT",
  
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    return /0x[a-fA-F0-9]{64}/.test(text) && 
           (/egg/i.test(text) || /af/i.test(text));
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
      console.log("Processing egg ownership check text:", text);

      // Extract wallet address
      const addressMatch = text.match(/0x[a-fA-F0-9]{64}/);
      if (!addressMatch) {
        if (callback) {
          callback({
            text: "Please provide a valid SUI wallet address.",
            content: { status: "missing_address" }
          });
        }
        return false;
      }

      state.address = addressMatch[0];
      console.log("Checking address:", state.address);
      
      const result = await checkEggOwnershipByAddressProvider.get(runtime, message, state);
      console.log("Provider result:", result);

      const parsedResult = JSON.parse(result);
      
      let responseText;
      if (parsedResult.success) {
        if (parsedResult.ownsEgg) {
          let location = [];
          if (parsedResult.hasKiosk) location.push("kiosk");
          if (parsedResult.hasWrapper) location.push("wrapper");
          
          responseText = `Address ${state.address} owns an AF egg`;
          if (location.length > 0) {
            responseText += ` (found in ${location.join(" and ")})`;
          }
        } else {
          responseText = `Address ${state.address} does not own any AF eggs`;
          if (parsedResult.hasKiosk) {
            responseText += " (checked kiosk contents)";
          }
        }
      } else {
        responseText = `Error checking egg ownership: ${parsedResult.error}`;
      }

      if (callback) {
        callback({
          text: responseText,
          content: { 
            status: parsedResult.success ? "success" : "error",
            result: parsedResult
          }
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
          text: "Check if 0xef0046268d4cedb330fd7d39be4540c9261bcad735dc4749f81b08dbb0e22af9 owns an AF egg",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Checking egg ownership...",
          action: "CHECK_ADDRESS_EGG_OWNERSHIP",
        },
      },
    ],
  ],
} as Action;