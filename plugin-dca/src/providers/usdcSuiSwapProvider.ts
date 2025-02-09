import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@firefly-exchange/library-sui";
import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot/query-chain.js";
import { OnChainCalls } from "@firefly-exchange/library-sui/dist/src/spot/on-chain-calls.js";
import { ISwapParams } from "@firefly-exchange/library-sui/dist/src/spot/interfaces/IOnchainCalls.js";
import { Ed25519Keypair, toBigNumber } from "@firefly-exchange/library-sui";
import { mainnet } from "./bluefinConfig.ts";

interface SwapState extends State {
  poolID?: string;
  amount?: number;
  slippage?: number;
}

// Hard-code the default pool ID for USDC→SUI swaps.
const DEFAULT_POOL_ID_USDC_SUI =
  "0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa";

export const usdcSuiSwapProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: SwapState
  ): Promise<string> => {
    try {
      const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });
      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR?.split(",").map(Number);
      if (!privateKeyArray) {
        throw new Error("Private key not configured");
      }
      const keyPair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

      // Initialize the on-chain call components.
      const oc = new OnChainCalls(client, mainnet, {
        signer: keyPair,
        isUIWallet: false,
        address: keyPair.toSuiAddress(),
        isZkLogin: false,
        zkPayload: null,
      });
      const qc = new QueryChain(client);

      // Always use the default pool ID.
      const poolID = state?.poolID || DEFAULT_POOL_ID_USDC_SUI;
      const poolState = await qc.getPool(poolID);

      // For a USDC→SUI swap:
      // - The input coin is USDC (coinB) and the output coin is SUI (coinA).
      // - Therefore, use coinB decimals for the input amount.
      // - Force aToB to false (swap from coinB to coinA) and byAmountIn to true.
      const iSwapParams: ISwapParams = {
        pool: poolState,
        amountIn: toBigNumber(state.amount, poolState.coin_b.decimals),
        amountOut: 0,
        aToB: false, // false: from coinB (USDC) to coinA (SUI)
        byAmountIn: true,
        slippage: state.slippage,
        applySlippageToPrice: true,
      };

      // Execute the swap using the SDK with a fixed gas budget.
      const result = await oc.swapAssets(iSwapParams, { gasBudget: 100_000_000 });
      const fullResult = JSON.stringify({ success: true, txHash: result });
      const summary =
        fullResult.length > 4000
          ? fullResult.substring(0, 4000) + "... (truncated)"
          : fullResult;
      return "```\n" + summary + "\n```";
    } catch (error: any) {
      console.error("USDC→SUI Swap Provider Error:", error);
      return JSON.stringify({
        success: false,
        error: error.message,
        details: error,
      });
    }
  },
};
