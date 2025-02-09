import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import useAftermath from "./useAftermath.ts";
import { Aftermath } from "aftermath-ts-sdk";

export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
  aftermathInstance?: Aftermath;
  dcaInstance?: any;
}

export interface ExtendedDcaProvider extends Provider {
  createDcaOrder: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DCAState
  ) => Promise<string>;
}

export const dcaProvider: ExtendedDcaProvider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DCAState
  ): Promise<string> => {
    console.log("\n[START] Connecting to Aftermath SDK (Account Setup and DCA)");

    try {
      // Create or re-use the SuiClient
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      console.log("\n[1] Loading wallet from SUI_PRIVATE_KEY_VAR");
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) {
        throw new Error("SUI_PRIVATE_KEY_VAR environment variable is missing");
      }

      // Convert SUI_PRIVATE_KEY_VAR into a Uint8Array
      let privateKeyBytes: Uint8Array;
      try {
        if (privateKeyVar.includes(",")) {
          privateKeyBytes = new Uint8Array(
            privateKeyVar.split(",").map((num) => parseInt(num.trim(), 10))
          );
        } else if (privateKeyVar.startsWith("0x")) {
          privateKeyBytes = Buffer.from(privateKeyVar.slice(2), "hex");
        } else {
          privateKeyBytes = Buffer.from(privateKeyVar, "base64");
        }
      } catch (error) {
        throw new Error(
          `Failed to parse SUI_PRIVATE_KEY_VAR: ${
            error instanceof Error ? error.message : "Unknown parsing error"
          }`
        );
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();
      console.log("✓ Wallet address:", walletAddress);

      // Check SUI balance for gas
      console.log("\n[3] Checking SUI balance for gas fees...");
      const balance = await client.getBalance({
        owner: walletAddress,
        coinType: "0x2::sui::SUI",
      });

      const minRequiredSui = BigInt(100_000_000); // e.g. 0.1 SUI
      if (BigInt(balance.totalBalance) < minRequiredSui) {
        throw new Error(
          `❌ Insufficient SUI for gas. Need at least ${
            minRequiredSui / BigInt(1_000_000_000)
          } SUI. Current balance: ${balance.totalBalance}`
        );
      }
      console.log(`✅ SUI balance is sufficient: ${balance.totalBalance} SUI`);

      console.log("\n[2] Connecting to Aftermath SDK for user account setup...");
      const { dca, instance } = await useAftermath(
        client,
        walletAddress,
        async ({ message }) => {
          const signResult = await keypair.signPersonalMessage(message);
          return {
            signature: signResult.signature.startsWith("0x")
              ? signResult.signature.slice(2)
              : signResult.signature,
            bytes: new Uint8Array(
              signResult.bytes.split("").map((char) => char.charCodeAt(0))
            ),
          } as { signature: string; bytes: Uint8Array };
        }
      );

      // Check if the user has any active DCA orders
      const activeOrders = await dca.getActiveDcaOrders({ walletAddress });
      console.log("Active DCA Orders:", activeOrders.length);

      // Store in the agent state
      if (state) {
        (state as DCAState).aftermathInstance = instance;
        (state as DCAState).walletAddress = walletAddress;
        (state as DCAState).dcaInstance = dca;
      }

      console.log("✓ Aftermath SDK Connected & user account verified/created!");
      return `SUCCESS: Aftermath account setup complete for ${walletAddress}`;
    } catch (error: any) {
      console.error("\n[ERROR] Aftermath Connection Failed:", error);
      console.error("Error Details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      return `ERROR: ${error.message}`;
    }
  },

  createDcaOrder: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DCAState
  ): Promise<string> => {
    try {
      // Ensure we have a wallet address and DCA instance
      if (!state || !state.walletAddress || !state.dcaInstance) {
        throw new Error("No wallet or DCA instance available");
      }
      const dca = state.dcaInstance;
      const walletAddress = state.walletAddress;

      // Create or reuse a SuiClient for fetching USDC balance:
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      // Check USDC balance before creating DCA order
      console.log("\n[4] Checking USDC Balance before creating DCA Order...");
      const usdcBalance = await client.getBalance({
        owner: walletAddress,
        coinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      });
      console.log("USDC Balance:", usdcBalance.totalBalance);

      // Validate USDC balance is sufficient
      const requiredUSDC = BigInt(4_000_000); // 4 USDC at 6 decimals
      if (BigInt(usdcBalance.totalBalance) < requiredUSDC) {
        throw new Error(
          `Insufficient USDC balance. Need ${requiredUSDC}, have ${usdcBalance.totalBalance}`
        );
      }

      // Hard-coded DCA parameters
      const dcaParams = {
        walletAddress,
        allocateCoinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        allocateCoinAmount: BigInt(4_000_000), // 4 USDC (6 decimals)
        buyCoinType:
          "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
        frequencyMs: 3600000, // Every hour
        tradesAmount: 2, // 2 trades
        delayTimeMs: 0, // Start immediately
        maxAllowableSlippageBps: 100, // 1% max slippage
        coinPerTradeAmount: BigInt(2_000_000), // 2 USDC per trade
        strategy: {
          minPrice: BigInt(10), // Very low minimum
          maxPrice: BigInt(1_000_000), // Close to 10 USD
        },
      };

      console.log("\n[4] Creating DCA Order...");
      console.log("DCA Parameters:", JSON.stringify(dcaParams, null, 2));

      // This will construct the transaction
      const tx = await dca.getCreateDcaOrderTx(dcaParams);
      console.log("✓ DCA Order Transaction Created:", tx);

      return `SUCCESS: DCA Order created for ${walletAddress}`;
    } catch (error: any) {
      console.error("\n[ERROR] DCA Order Creation Failed:", error);
      console.error("Full Error Details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      return `ERROR: ${error.message}`;
    }
  },
};
