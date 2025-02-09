import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { SuiClient } from "@mysten/sui.js/client";
import useAftermath from "./useAftermath.ts";

export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
}

export const dcaProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: DCAState): Promise<string> => {
    console.log("\n[START] Connecting to Aftermath SDK");

    try {
      // --- 1: Initialize Sui Client ---
      const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });

      // --- 2: Load Private Key ---
      console.log("\n[1] Loading wallet from SUI_PRIVATE_KEY_VAR");
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;

      if (!privateKeyVar) throw new Error("SUI_PRIVATE_KEY_VAR environment variable is missing");

      let privateKeyBytes;
      try {
          privateKeyBytes = new Uint8Array(privateKeyVar.split(",").map(Number));
      } catch (error) {
          throw new Error("Failed to parse SUI_PRIVATE_KEY_VAR. Ensure it is properly formatted.");
      }

      console.log("🔹 Parsed Private Key:", privateKeyBytes);

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();

      console.log("✓ Wallet address:", walletAddress);

      // --- 3: Ensure Enough SUI for Gas ---
      console.log("\n[3] Checking SUI balance for gas fees...");

      const balance = await client.getBalance({ owner: walletAddress, coinType: "0x2::sui::SUI" });

      const minRequiredSui = BigInt(100_000_000); // Example: 0.1 SUI required for gas
      if (BigInt(balance.totalBalance) < minRequiredSui) {
          throw new Error(`❌ Insufficient SUI for gas. You need at least ${minRequiredSui / BigInt(1_000_000_000)} SUI.`);
      }

      console.log(`✅ SUI balance is sufficient: ${balance.totalBalance} SUI`);


      // --- 4: Initialize Aftermath SDK ---
      console.log("\n[2] Connecting to Aftermath SDK");
      const aftermath = await useAftermath(client, walletAddress, async ({ message }) => {
        return keypair.signPersonalMessage(message);
      });

      console.log("✓ Aftermath SDK Connected");

      return `SUCCESS: Aftermath connection established`;
    } catch (error: any) {
      console.error("\n[ERROR] Aftermath Connection Failed:", error);
      return `ERROR: ${error.message}`;
    }
  },
};
