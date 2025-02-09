
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import useAftermath from "./useAftermath.ts";
import { Aftermath } from "aftermath-ts-sdk";

/** Standard state interface for DCA */
export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
  aftermathInstance?: Aftermath;
  dcaInstance?: any;
}

/** Define your provider's interface: */
export interface ExtendedDcaProvider extends Provider {
  createDcaOrder: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DCAState
  ) => Promise<string>;
}

/**
 * This provider has two main methods:
 *  1) get(...) - sets up Aftermath and stores dcaInstance in state
 *  2) createDcaOrder(...) - constructs + finalizes (signs + executes) the order on-chain
 */
export const dcaProvider: ExtendedDcaProvider = {
  /**
   * 1) Connect to Aftermath & store in `state`.
   */
  get: async (runtime, message, state?: DCAState): Promise<string> => {
    console.log("[DCAProvider] Starting DCA setup...");

    try {
      // Create a SuiClient (for mainnet here)
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      // Load private key from environment
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) {
        throw new Error("SUI_PRIVATE_KEY_VAR missing.");
      }

      // Convert privateKeyVar to bytes
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

      // Create keypair + address
      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();
      console.log("[DCAProvider] Wallet address:", walletAddress);

      // (Optional) Check SUI gas balance
      const balance = await client.getBalance({
        owner: walletAddress,
        coinType: "0x2::sui::SUI",
      });
      const needed = BigInt(100_000_000); // 0.1 SUI
      if (BigInt(balance.totalBalance) < needed) {
        throw new Error(`Need 0.1 SUI, only have ${balance.totalBalance}`);
      }

      // Use your existing "useAftermath" hook
      const { dca, instance } = await useAftermath(client, walletAddress, async ({ message }) => {
        const signResult = await keypair.signPersonalMessage(message);
        return {
          signature: signResult.signature.startsWith("0x")
            ? signResult.signature.slice(2)
            : signResult.signature,
          bytes: new Uint8Array(
            signResult.bytes.split("").map((c) => c.charCodeAt(0))
          ),
        };
      });

      // Confirm user has a DCA instance
      const active = await dca.getActiveDcaOrders({ walletAddress });
      console.log("[DCAProvider] Current active orders:", active.length);

      // Store references in state for reuse
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

  /**
   * 2) Build, sign, and execute the DCA create transaction on-chain using "Transaction".
   */
  createDcaOrder: async (runtime, message, state?: DCAState): Promise<string> => {
    try {
      // Check we have a dcaInstance
      if (!state?.dcaInstance || !state?.walletAddress) {
        throw new Error("No DCA instance or walletAddress found in state");
      }

      const dca = state.dcaInstance;
      const walletAddress = state.walletAddress;

      // Build a SuiClient for broadcast
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      // Optional: check USDC balance
      const usdcBalance = await client.getBalance({
        owner: walletAddress,
        coinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
      });
      if (BigInt(usdcBalance.totalBalance) < BigInt(4_000_000)) {
        throw new Error(`Need 4 USDC, only have ${usdcBalance.totalBalance}`);
      }

      // Hardcoded DCA params
      const dcaParams = {
        walletAddress,
        allocateCoinType:
          "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        allocateCoinAmount: BigInt(4_000_000),
        buyCoinType:
          "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
        frequencyMs: 3600000, // 1hr
        tradesAmount: 2,
        delayTimeMs: 0,
        maxAllowableSlippageBps: 100,
        coinPerTradeAmount: BigInt(2_000_000),
        strategy: {
          minPrice: BigInt(10),
          maxPrice: BigInt(1_000_000),
        },
      };

      console.log("[DCAProvider] Constructing createDCA transaction...");
      const tx = await dca.getCreateDcaOrderTx(dcaParams);
      // Because the older SDK uses "Transaction" from '@mysten/sui/transactions',
      // we can cast or confirm we have a "Transaction" type. 
      // Actually, "getCreateDcaOrderTx(...)" often returns the new "TransactionBlock" type.
      // We'll assume it is "Transaction" compatible for the sake of example:
      // If the mismatch occurs, you'd want to adapt your Sui version to match Aftermath's usage.

      // 1) Set the sender (some Sui versions do: tx.setSender())
      tx.setSender(walletAddress);

      // 2) Build final transaction bytes
      const txBytes = await tx.build({ provider: client });
      console.log("[DCAProvider] DCA transaction built. Bytes length:", txBytes.length);

      // 3) We must sign + execute
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) {
        throw new Error("Missing SUI_PRIVATE_KEY_VAR at sign time");
      }

      let pkBytes: Uint8Array;
      if (privateKeyVar.includes(",")) {
        pkBytes = new Uint8Array(
          privateKeyVar.split(",").map((n) => parseInt(n.trim(), 10))
        );
      } else if (privateKeyVar.startsWith("0x")) {
        pkBytes = Buffer.from(privateKeyVar.slice(2), "hex");
      } else {
        pkBytes = Buffer.from(privateKeyVar, "base64");
      }
      const keypair = Ed25519Keypair.fromSecretKey(pkBytes);

      // 4) Sign the transaction 
      //    (If using the "Transaction" class, usually "signTransaction(txBytes)")
      const signature = await keypair.signTransaction(txBytes);

      // 5) Execute on-chain
      const response = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: signature.signature,
        requestType: "WaitForLocalExecution",
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      // Check final status
      const status = response.effects?.status?.status;
      if (status !== "success") {
        console.error("[DCAProvider] Tx not successful:", response);
        throw new Error("Transaction failed or was not successful");
      }

      console.log("[DCAProvider] DCA order created on-chain!");
      return `SUCCESS: DCA order created & broadcast for ${walletAddress}`;
    } catch (error: any) {
      console.error("[DCAProvider] createDcaOrder error:", error);
      return `ERROR: ${error.message}`;
    }
  },
};
