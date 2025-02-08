import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@firefly-exchange/library-sui";
import { QueryChain } from "@firefly-exchange/library-sui/dist/src/spot/query-chain.js";
import { OnChainCalls } from "@firefly-exchange/library-sui/dist/src/spot/on-chain-calls.js";
import { ISwapParams } from "@firefly-exchange/library-sui/dist/src/spot/interfaces/IOnchainCalls.js";
import { Ed25519Keypair, toBigNumber } from "@firefly-exchange/library-sui";
import { mainnet } from './bluefinConfig.ts';

interface SwapState extends State {
   poolID?: string;
   amount?: number;
   aToB?: boolean;
   byAmountIn?: boolean;
   slippage?: number;
}

export const bluefinSwapProvider: Provider = {
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

            // Initialize SDK components
            const oc = new OnChainCalls(client, mainnet, {
                signer: keyPair,
                isUIWallet: false,
                address: keyPair.toSuiAddress(),
                isZkLogin: false,
                zkPayload: null
            });
            const qc = new QueryChain(client);

            // Get pool state
            const poolState = await qc.getPool(state.poolID);

            // Prepare swap parameters
            const iSwapParams: ISwapParams = {
                pool: poolState,
                amountIn: state.byAmountIn ? toBigNumber(state.amount, (state.aToB ? poolState.coin_a.decimals : poolState.coin_b.decimals)) : 0,
                amountOut: state.byAmountIn ? 0 : toBigNumber(state.amount, (state.aToB ? poolState.coin_b.decimals : poolState.coin_a.decimals)),
                aToB: state.aToB,
                byAmountIn: state.byAmountIn,
                slippage: state.slippage,
                applySlippageToPrice: true
            };



            // Execute swap using SDK
            const result = await oc.swapAssets(iSwapParams, { gasBudget: 100_000_000 });
            

            const fullResult = JSON.stringify({
                success: true,
                txHash: result
              });
              const summary =
                fullResult.length > 4000
                  ? fullResult.substring(0, 4000) + '... (truncated)'
                  : fullResult;
              // Wrap in triple backticks to force code formatting:
              const formattedSummary = "```\n" + summary + "\n```";
              return formattedSummary;

        } catch (error) {
            console.error("Bluefin Swap Provider Error:", error);
            return JSON.stringify({
                success: false,
                error: error.message,
                details: error
            });
        }
    }
};