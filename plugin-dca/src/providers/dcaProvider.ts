import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import useAftermath from "./useAftermath.ts";
import { Aftermath } from "aftermath-ts-sdk";

export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
  aftermathInstance?: Aftermath;
  dcaInstance?: any;
  dcaParams?: {
    frequencyMs?: number;
    tradesAmount?: number;
    delayTimeMs?: number;
    allocateAmount?: bigint;
    strategy?: {
      minPrice?: bigint;
      maxPrice?: bigint;
    };
  };
}

export interface ExtendedDcaProvider extends Provider {
  get: (runtime: IAgentRuntime, message: Memory, state?: DCAState) => Promise<string>;
  createDcaOrder: (runtime: IAgentRuntime, message: Memory, state?: DCAState) => Promise<string>;
}

export const dcaProvider: ExtendedDcaProvider = {
  get: async (runtime, message, state?: DCAState): Promise<string> => {
    console.log("[DCAProvider] Starting DCA setup...");
    try {
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) throw new Error("SUI_PRIVATE_KEY_VAR missing.");

      let privateKeyBytes: Uint8Array;
      if (privateKeyVar.includes(",")) {
        privateKeyBytes = new Uint8Array(
          privateKeyVar.split(",").map((n) => parseInt(n.trim(), 10))
        );
      } else if (privateKeyVar.startsWith("0x")) {
        privateKeyBytes = Buffer.from(privateKeyVar.slice(2), "hex");
      } else {
        privateKeyBytes = Buffer.from(privateKeyVar, "base64");
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();

      const { dca, instance } = await useAftermath(client, walletAddress, async ({ message }) => {
        const signResult = await keypair.signPersonalMessage(message);
        return {
          signature: signResult.signature.startsWith("0x")
            ? signResult.signature.slice(2)
            : signResult.signature,
          bytes: new Uint8Array(signResult.bytes.split("").map((c) => c.charCodeAt(0))),
        };
      });

      if (state) {
        state.suiAccount = keypair;
        state.walletAddress = walletAddress;
        state.aftermathInstance = instance;
        state.dcaInstance = dca;
      }

      return `SUCCESS: DCA setup complete for ${walletAddress}`;
    } catch (error: any) {
      console.error("[DCAProvider] Setup error:", error);
      return `ERROR: ${error.message}`;
    }
  },

  createDcaOrder: async (runtime, message, state?: DCAState): Promise<string> => {
    try {
      if (!state?.dcaInstance || !state?.walletAddress) {
        throw new Error("No DCA instance or walletAddress found in state");
      }

      const dca = state.dcaInstance;
      const walletAddress = state.walletAddress;

      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      const usdcBalance = await client.getBalance({
        owner: walletAddress,
        coinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      });
      if (BigInt(usdcBalance.totalBalance) < BigInt(4_000_000)) {
        throw new Error(`Need 4 USDC, only have ${usdcBalance.totalBalance}`);
      }

      const allocateAmount: bigint = state.dcaParams?.allocateAmount || BigInt(4000000);
      const tradesAmount: number = state.dcaParams?.tradesAmount || 2;
      const frequencyMs: number = state.dcaParams?.frequencyMs || 3600000;
      const delayTimeMs: number = state.dcaParams?.delayTimeMs || 0;
      const minPrice: bigint = state.dcaParams?.strategy?.minPrice || BigInt(10);
      const maxPrice: bigint = state.dcaParams?.strategy?.maxPrice || BigInt(1000000);

      const dcaParams = {
        walletAddress,
        allocateCoinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        allocateCoinAmount: allocateAmount,
        buyCoinType:
          "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
        frequencyMs,
        tradesAmount,
        delayTimeMs,
        maxAllowableSlippageBps: 100,
        coinPerTradeAmount: allocateAmount / BigInt(tradesAmount),
        strategy: {
          minPrice,
          maxPrice,
        },
      };

      console.log("[DCAProvider] Creating DCA with params:", dcaParams);
      console.log("[DCAProvider] Constructing createDCA transaction...");

      const tx = await dca.getCreateDcaOrderTx(dcaParams);
      tx.setSender(walletAddress);
      const txBytes = await tx.build({ provider: client });
      console.log("[DCAProvider] DCA transaction built. Bytes length:", txBytes.length);

      const signature = await state.suiAccount!.signTransaction(txBytes);
      const response = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: signature.signature,
        requestType: "WaitForLocalExecution",
        options: { showEffects: true, showEvents: true },
      });

      if (response.effects?.status?.status !== "success") {
        throw new Error("Transaction failed");
      }

      return `SUCCESS: DCA order created & broadcast for ${walletAddress}`;
    } catch (error: any) {
      console.error("[DCAProvider] createDcaOrder error:", error);
      return `ERROR: ${error.message}`;
    }
  },
};
