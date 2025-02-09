import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
  } from "@elizaos/core";
  import { suiUsdcSwapProvider } from "../providers/suiUsdcSwapProvider.ts";
  
  interface SwapState extends State {
    poolID?: string;
    amount?: number;
    aToB?: boolean;
    byAmountIn?: boolean;
    slippage?: number;
  }
  
  // Hard-code the default pool ID for SUI→USDC swaps.
  const DEFAULT_POOL_ID = "0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa";
  
  export default {
    name: "SUI_USDC_SWAP",
    similes: ["SWAP_SUI_USDC", "EXECUTE_SUI_USDC_SWAP", "TRADE_SUI_FOR_USDC"],
    description:
      "Execute a SUI→USDC swap on Bluefin using a predetermined pool contract address.",
    validate: async (runtime: IAgentRuntime, message: Memory) => {
      const text = message.content.text?.toLowerCase() || "";
      // For SUI→USDC swaps, require that the message mentions both "sui" and "usdc".
      return /sui/i.test(text) && /usdc/i.test(text);
    },
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: SwapState,
      _options: { [key: string]: unknown },
      callback?: HandlerCallback
    ): Promise<boolean> => {
      try {
        const text = message.content.text?.toLowerCase() || "";
        console.log("Processing SUI→USDC swap text:", text);
  
        // Here we ignore any pool ID provided by the user and default to our predetermined pool.
        state.poolID = DEFAULT_POOL_ID;
  
        // Extract the amount from the text.
        const amountMatch = text.match(/(\d+\.?\d*)/);
        if (!amountMatch) {
          if (callback) {
            callback({
              text: "Please specify an amount for the swap.",
              content: { status: "missing_amount" },
            });
          }
          return false;
        }
        const amount = parseFloat(amountMatch[1]);
  
        // For this provider we assume a SUI→USDC swap:
        // Force aToB to true (swap from coinA (SUI) to coinB (USDC))
        // And assume byAmountIn is true (i.e. the amount is the input amount)
        state.amount = amount;
        state.aToB = true;
        state.byAmountIn = true;
  
        // Extract slippage if specified (default to 0.1%).
        const slippageMatch = text.match(/slippage\s+(\d+\.?\d*)/i);
        state.slippage = slippageMatch ? parseFloat(slippageMatch[1]) / 100 : 0.001;
  
        console.log("Executing SUI→USDC swap with params:", {
          poolID: state.poolID,
          amount: state.amount,
          slippage: state.slippage,
        });
  
        const result = await suiUsdcSwapProvider.get(runtime, message, state);
        console.log("SUI→USDC Provider result:", result);
  
        if (callback) {
          callback({ text: result, content: { status: "success" } });
        }
        return true;
      } catch (error: any) {
        console.error("SUI→USDC Swap Action Error:", error);
        if (callback) {
          callback({
            text: `Error executing swap: ${error.message || "Unknown error"}`,
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
            text: "Swap 0.1 sui for usdc",
          },
        },
        {
          user: "{{user2}}",
          content: {
            text: "Executing SUI→USDC swap...",
            action: "SUI_USDC_SWAP",
          },
        },
      ],
    ],
  } as Action;
  