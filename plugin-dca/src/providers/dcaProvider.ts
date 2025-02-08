import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { Aftermath } from "aftermath-ts-sdk";
import { SuiClient } from "@mysten/sui/client";

// Extend the core State with our custom fields
export interface DCAState extends State {
  walletAddress?: string;
  suiAccount?: Ed25519Keypair;
  // Additional DCA-specific properties (e.g. dcaParams) can be stored here
}

// Module-level variables to reuse our SDK instance and auth object
let client: SuiClient;
let afSdk: Aftermath;
let auth: any;

export const dcaProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: DCAState): Promise<string> => {
    console.log("\n[START] Beginning DCA setup process =====================");
    try {
      // --- Test 1: SDK Initialization ---
      console.log("\n[TEST 1] SDK Initialization");
      if (!afSdk) {
        console.log("Creating new Aftermath SDK instance");
        afSdk = new Aftermath("MAINNET"); // Change to "TESTNET" if using test keys
        await afSdk.init();
        console.log("✓ SDK initialized successfully");
      } else {
        console.log("✓ Using existing SDK instance");
      }

      // --- Test 2: Keypair and Wallet Setup ---
      console.log("\n[TEST 2] Wallet Setup");
      if (!process.env.SUI_PRIVATE_KEY_VAR) {
        throw new Error("SUI_PRIVATE_KEY_VAR environment variable not found");
      }
      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR.split(',').map(Number);
      const suiAccount = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      const walletAddress = suiAccount.getPublicKey().toSuiAddress();
      console.log("✓ Generated wallet address:", walletAddress);

      // --- Test 3: Public API Access ---
      console.log("\n[TEST 3] Testing Public API Access");
      const pools = afSdk.Pools();
      const allPools = await pools.getAllPools();
      console.log(`✓ Successfully fetched ${allPools.length} pools`);

      // --- Test 4: Auth Initialization via auth.init ---
      console.log("\n[TEST 4] Initializing Auth");
      auth = afSdk.Auth();
      const stopAuth = await auth.init({
        walletAddress,
        signMessageCallback: async ({ message }) => {
          // Log the raw message (in hex) for inspection
          console.log("Auth init signing message (raw bytes):", Buffer.from(message).toString("hex"));
          const sig = await suiAccount.signPersonalMessage(message);
          console.log("Auth init signature (Base64):", Buffer.from(sig.signature).toString("base64"));
          return sig;
        },
      });
      console.log("✓ Auth initialized successfully");

      // --- Test 5: Create DCA Account ---
      console.log("\n[TEST 5] Creating DCA Account");
      const dca = afSdk.Dca();
      const createAccountMessage = dca.createUserAccountMessageToSign();
      console.log("Create account message:", JSON.stringify(createAccountMessage));
      const createAccountSig = await suiAccount.signPersonalMessage(
        new TextEncoder().encode(JSON.stringify(createAccountMessage))
      );
      console.log("Create account signature (Base64):", Buffer.from(createAccountSig.signature).toString('base64'));
      const accountCreated = await dca.createUserPublicKey({
        walletAddress,
        bytes: JSON.stringify(createAccountMessage),
        signature: Buffer.from(createAccountSig.signature).toString('base64')
      });
      if (accountCreated) {
        console.log("✓ DCA account created successfully");
      } else {
        console.log("✓ DCA account already exists or creation failed");
      }

      // --- Test 6: Create DCA Order with 2.5 SUI ---
      // This example creates an order that allocates 2.5 SUI (2,500,000,000 units).
      console.log("\n[TEST 6] Creating DCA Order with 2.5 SUI");
      
      const orderTx = await dca.getCreateDcaOrderTx({
        walletAddress,
        // Use USDC as the allocated coin (the asset you're spending)
        allocateCoinType: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174::coin::USDC",
        // For example, if USDC has 6 decimals then 2.5 USDC = 2,500,000 units
        allocateCoinAmount: BigInt(2500000), // 2.5 USDC (adjust if decimals differ)
        // You want to buy SUI, so set buyCoinType to SUI
        buyCoinType: "0x2::sui::SUI",
        frequencyMs: 3600000, // Execute trade every hour
        tradesAmount: 5,      // Split the total order into 5 trades
        delayTimeMs: 0,       // Start immediately
        maxAllowableSlippageBps: 250, // 2.5% maximum slippage
        // Divide the total allocated amount equally (e.g. 2.5 USDC / 5 = 0.5 USDC per trade)
        coinPerTradeAmount: BigInt(500000), // 0.5 USDC per trade (if USDC is 6 decimals)
        strategy: {
          // Example strategy values – these should reflect the current market conditions
          minPrice: BigInt(4000000),
          maxPrice: BigInt(8000000),
        },
      });
      console.log("✓ DCA order transaction created:", orderTx);
      

      // --- Store state for later use ---
      if (state) {
        state.suiAccount = suiAccount;
        state.walletAddress = walletAddress;
      }

      return "SUCCESS: Initial tests completed and DCA order created";
    } catch (error: any) {
      console.error("\n[ERROR] Test failed:", {
        error,
        message: error.message,
        stack: error.stack
      });
      return `ERROR:${error.message}`;
    }
  }
};
