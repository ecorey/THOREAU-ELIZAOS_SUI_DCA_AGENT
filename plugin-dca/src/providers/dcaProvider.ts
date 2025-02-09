import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import useAftermath from "./useAftermath.ts";

export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
  aftermathInstance?: any;
}

export const dcaProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DCAState
  ): Promise<string> => {
    console.log("\n[START] Connecting to Aftermath SDK (Account Setup)");

    try {
      // 1) Create SuiClient
      const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

      // 2) Load Private Key
      console.log("\n[1] Loading wallet from SUI_PRIVATE_KEY_VAR");
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      
      if (!privateKeyVar) {
        throw new Error("SUI_PRIVATE_KEY_VAR environment variable is missing");
      }

      // 3) Parse Private Key 
      let privateKeyBytes: Uint8Array;
      try {
        // Try comma-separated numbers
        if (privateKeyVar.includes(',')) {
          privateKeyBytes = new Uint8Array(
            privateKeyVar.split(',').map((num) => parseInt(num.trim(), 10))
          );
        } 
        // Try hex format
        else if (privateKeyVar.startsWith('0x')) {
          privateKeyBytes = Buffer.from(privateKeyVar.slice(2), 'hex');
        } 
        // Try base64
        else {
          privateKeyBytes = Buffer.from(privateKeyVar, 'base64');
        }
      } catch (error) {
        throw new Error(
          `Failed to parse SUI_PRIVATE_KEY_VAR: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
        );
      }

      console.log("🔹 Parsed Private Key (first 5 bytes):", privateKeyBytes.slice(0, 5));

      // 4) Create keypair & get wallet address
      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();
      console.log("✓ Wallet address:", walletAddress);

      // 5) Check SUI balance for gas
      console.log("\n[3] Checking SUI balance for gas fees...");
      const balance = await client.getBalance({
        owner: walletAddress,
        coinType: "0x2::sui::SUI"
      });

      const minRequiredSui = BigInt(100_000_000); // 0.1 SUI example
      if (BigInt(balance.totalBalance) < minRequiredSui) {
        throw new Error(
          `❌ Insufficient SUI for gas. Need at least ${
            minRequiredSui / BigInt(1_000_000_000)
          } SUI. Current balance: ${balance.totalBalance}`
        );
      }
      console.log(`✅ SUI balance is sufficient: ${balance.totalBalance} SUI`);

      // 6) Connect to Aftermath (sets up user's public key if needed)
      console.log("\n[2] Connecting to Aftermath SDK for user account setup...");
      const { dca, instance } = await useAftermath(client, walletAddress, async ({ message }) => {
        const signResult = await keypair.signPersonalMessage(message);
        return { 
          signature: signResult.signature.startsWith('0x') 
            ? signResult.signature.slice(2) 
            : signResult.signature,
          bytes: new Uint8Array(signResult.bytes.split('').map(char => char.charCodeAt(0)))
        } as { signature: string; bytes: Uint8Array };
      });

      // Optional: Store aftermath in state
      if (state) {
        (state as DCAState).aftermathInstance = instance;
        (state as DCAState).walletAddress = walletAddress;
      }

      console.log("✓ Aftermath SDK Connected & user account verified/created!");

      return `SUCCESS: Aftermath account setup complete for ${walletAddress}`;
    } catch (error: any) {
      console.error("\n[ERROR] Aftermath Connection Failed:", error);
      console.error("Error Details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });

      return `ERROR: ${error.message}`;
    }
  },
};