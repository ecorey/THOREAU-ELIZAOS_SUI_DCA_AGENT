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
  aToB?: boolean;
  byAmountIn?: boolean;
  slippage?: number;
}

// Hard-code the default pool ID for SUI→USDC swaps.
const DEFAULT_POOL_ID = "0x3b585786b13af1d8ea067ab37101b6513a05d2f90cfe60e8b1d9e1b46a63c4fa";

export const suiUsdcSwapProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: SwapState
  ): Promise<string> => {
    try {
      const client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
      });

      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR?.split(",").map(Number);
      if (!privateKeyArray) {
        throw new Error("Private key not configured");
      }
      const keyPair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

      // Initialize SDK components.
      const oc = new OnChainCalls(client, mainnet, {
        signer: keyPair,
        isUIWallet: false,
        address: keyPair.toSuiAddress(),
        isZkLogin: false,
        zkPayload: null,
      });
      const qc = new QueryChain(client);

      // Use the hard-coded pool ID if none is provided.
      const poolID = state?.poolID || DEFAULT_POOL_ID;
      const poolState = await qc.getPool(poolID);

      // Prepare swap parameters.
      // For a SUI→USDC swap we assume the following for this provider:
      // - The input coin is SUI (coinA) and the output coin is USDC (coinB).
      // - The action will use the state.aToB and state.byAmountIn as provided (or you can force them).
      // Here we assume that this provider is for swapping SUI for USDC.
      const iSwapParams: ISwapParams = {
        pool: poolState,
        amountIn: state.byAmountIn
          ? toBigNumber(state.amount, poolState.coin_a.decimals)
          : 0,
        amountOut: state.byAmountIn
          ? 0
          : toBigNumber(state.amount, poolState.coin_b.decimals),
        // For SUI→USDC, we want to swap from coinA (SUI) to coinB (USDC)
        aToB: true,
        byAmountIn: state.byAmountIn,
        slippage: state.slippage,
        applySlippageToPrice: true,
      };

      // Execute the swap using the SDK with a fixed gas budget.
      const result = await oc.swapAssets(iSwapParams, { gasBudget: 100_000_000 });

      // Format the result for display (truncating if necessary).
      const fullResult = JSON.stringify({ success: true, txHash: result });
      const summary =
        fullResult.length > 4000
          ? fullResult.substring(0, 4000) + "... (truncated)"
          : fullResult;
      return "```\n" + summary + "\n```";
    } catch (error: any) {
      console.error("SUI→USDC Swap Provider Error:", error);
      return JSON.stringify({
        success: false,
        error: error.message,
        details: error,
      });
    }
  },
};
