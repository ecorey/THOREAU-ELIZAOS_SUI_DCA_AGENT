import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    elizaLogger,
    type Action
  } from "@elizaos/core";
  import { dcaProvider, DCAState } from "../providers/dcaProvider.ts";
  
  // Helper function to parse DCA parameters from the user message
  function parseDCAParams(message: Memory): Record<string, any> {
    const text = message.content.text?.toLowerCase() || '';
    const params: Record<string, any> = {};
  
    // Parse SUI amount if specified (e.g., "10 sui")
    const suiMatch = text.match(/(\d+)\s*sui/i);
    if (suiMatch) {
      const amount = parseInt(suiMatch[1], 10);
      // Convert SUI amount to decimals (example: 1 SUI = 1,000,000,000)
      params.allocateCoinAmount = BigInt(amount * 1_000_000_000);
    }
    
    // Default parameters for DCA setup
    return {
      allocateCoinType: "0x2::sui::SUI",
      allocateCoinAmount: BigInt(200_000_000), // Default 0.2 SUI if not specified
      buyCoinType: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
      frequencyMs: 3600000, // Execute every hour
      tradesAmount: 5,
      ...params
    };
  }
  
  export default {
    name: "CREATE_DCA",
    similes: ["SETUP_DCA", "START_DCA", "SETUP_ACCOUNT", "CREATE_ACCOUNT"],
    description: "Sets up DCA (Dollar Cost Averaging) trading on Aftermath Finance",
    
    // Validate that the message contains DCA keywords and setup instructions
    validate: async (runtime: IAgentRuntime, message: Memory) => {
      console.log("Validating DCA setup request from user:", message.userId);
      const text = message.content.text?.toLowerCase() || '';
      const hasDCATerms = text.includes('dca') || text.includes('dollar cost') || text.includes('averaging');
      const hasActionTerms = text.includes('setup') || text.includes('create') || text.includes('start');
      return hasDCATerms && hasActionTerms;
    },
  
    // The handler calls the dcaProvider to run through the DCA setup process
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: DCAState,
      _options: { [key: string]: unknown },
      callback?: HandlerCallback
    ): Promise<boolean> => {
      elizaLogger.log("Starting CREATE_DCA handler...");
  
      try {
        // Parse any DCA parameters from the user's message
        const params = parseDCAParams(message);
        (state as any).dcaParams = params;
  
        // Ensure we have a wallet address if not already set
        if (!state.walletAddress) {
          const walletAddress = process.env.SUI_WALLET_ADDRESS || process.env.DEFAULT_WALLET_ADDRESS;
          if (!walletAddress) {
            throw new Error("No wallet address provided. Please set SUI_WALLET_ADDRESS in environment");
          }
          state.walletAddress = walletAddress;
        }
        console.log("Using wallet address:", state.walletAddress);
  
        // Execute the DCA setup via the provider
        const result = await dcaProvider.get(runtime, message, state);
  
        if (callback) {
          let responseText: string;
          if (result === "SUCCESS: Initial tests completed") {
            responseText = "Successfully set up your DCA trading. Your account will now automatically execute trades according to the specified schedule.";
          } else if (result.startsWith("ERROR:")) {
            const errorMsg = result.replace("ERROR:", "").trim();
            responseText = `Error setting up DCA: ${errorMsg}. Please check your wallet balance and try again.`;
          } else {
            responseText = `Unexpected result: ${result}. Please try again or contact support.`;
          }
  
          callback({
            text: responseText,
            content: {
              status: result,
              params: params
            }
          });
        }
  
        return result.startsWith("SUCCESS");
      } catch (error: any) {
        console.error("Error during DCA setup:", error);
        if (callback) {
          callback({
            text: `Error setting up DCA: ${error.message}. Please ensure you have sufficient funds and permissions.`,
            content: { error: error.message, errorType: error.name }
          });
        }
        return false;
      }
    },
  
    examples: [
      [
        {
          user: "{{user1}}",
          content: { text: "Set up DCA trading for me" }
        },
        {
          user: "{{user2}}",
          content: {
            text: "Setting up your DCA trading strategy...",
            action: "CREATE_DCA"
          }
        }
      ],
      [
        {
          user: "{{user1}}",
          content: { text: "Create a DCA account with 10 SUI" }
        },
        {
          user: "{{user2}}",
          content: {
            text: "Setting up your DCA account...",
            action: "CREATE_DCA"
          }
        }
      ]
    ] as ActionExample[][],
  } as Action;
  