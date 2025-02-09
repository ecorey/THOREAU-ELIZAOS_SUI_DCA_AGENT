import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";
import { usdcSuiSwapProvider } from "../providers/usdcSuiSwapProvider.ts";

interface SwapState extends State {
  poolID?: string;
  amount?: number;
  slippage?: number;
}

const DEFAULT_POOL_ID_USDC_SUI =
  "0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa";

export default {
  name: "USDC_SUI_SWAP",
  similes: ["SWAP_USDC_TO_SUI", "EXECUTE_USDC_SUI_SWAP"],
  description:
    "Execute a USDC→SUI swap on Bluefin using a predetermined pool contract address.",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    // Require that the text contains both 'usdc' and 'sui' to disambiguate.
    return /usdc/i.test(text) && /sui/i.test(text);
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
      console.log("Processing USDC→SUI swap text:", text);

      // Override any provided pool ID with our predetermined pool.
      state.poolID = DEFAULT_POOL_ID_USDC_SUI;

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
      state.amount = amount;

      // For a USDC→SUI swap, we force:
      // - aToB = false (swap from coinB (USDC) to coinA (SUI))
      // - byAmountIn = true (the amount provided is the input in USDC)
      state.aToB = false;
      state.byAmountIn = true;

      // Extract slippage if provided; default to 0.1% (0.001).
      const slippageMatch = text.match(/slippage\s+(\d+\.?\d*)/i);
      state.slippage = slippageMatch ? parseFloat(slippageMatch[1]) / 100 : 0.001;

      console.log("Executing USDC→SUI swap with params:", {
        poolID: state.poolID,
        amount: state.amount,
        slippage: state.slippage,
      });

      const result = await usdcSuiSwapProvider.get(runtime, message, state);
      console.log("USDC→SUI Provider result:", result);

      if (callback) {
        callback({ text: result, content: { status: "success" } });
      }
      return true;
    } catch (error: any) {
      console.error("USDC→SUI Swap Action Error:", error);
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
          text: "Swap 4 usdc for sui",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Executing USDC→SUI swap...",
          action: "USDC_SUI_SWAP",
        },
      },
    ],
  ],
} as Action;
