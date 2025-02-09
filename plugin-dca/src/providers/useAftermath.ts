import { Aftermath } from "aftermath-ts-sdk";
import type { SuiClient } from "@mysten/sui/client";
import { bcs } from "@mysten/sui/bcs";

let instance: Aftermath | null = null;

const useAftermath = async (
  client: SuiClient,
  walletAddress: string,
  signMessageCallback: (input: { message: Uint8Array }) => Promise<{ signature: string; bytes?: Uint8Array }>
) => {
  // Initialize Aftermath SDK if not already initialized
  if (!instance) {
    console.log("✅ Initializing Aftermath SDK...");
    instance = new Aftermath("MAINNET");
    await instance.init();
  }

  const dca = instance.Dca();

  // Check for existing public key
  console.log("🔍 Checking for existing public key...");
  const userPublicKey = await dca.getUserPublicKey({ walletAddress });

  if (userPublicKey) {
    console.log("✅ User already has a public key:", userPublicKey);
    return { dca, instance };
  }

  // Create user public key if missing
  console.log("❌ No public key found. Creating a new one...");
  try {
    // Prepare message to sign
    const messageToSign = dca.createUserAccountMessageToSign();
    const messageBytes = new TextEncoder().encode(JSON.stringify(messageToSign));

    console.log("🔹 Signing message...");
    const signResult = await signMessageCallback({ message: messageBytes });

    // Ensure we have a valid signature
    if (!signResult.signature) {
      throw new Error("No signature generated");
    }

    // Encode message and signature
    const encodedMessage = Buffer.from(messageBytes).toString('base64');
    
    // Handle signature (remove '0x' if present)
    const signature = signResult.signature.startsWith('0x') 
      ? signResult.signature.slice(2) 
      : signResult.signature;

    console.log("Encoded Message:", encodedMessage);
    console.log("Signature:", signature);

    // Create public key
    const success = await dca.createUserPublicKey({
      walletAddress,
      bytes: encodedMessage,
      signature: signature
    });

    if (success) {
      console.log("✅ Successfully created user public key!");
    } else {
      throw new Error("Failed to create user public key");
    }
  } catch (error) {
    console.error("❌ Error creating user public key:", error);
    throw error;
  }

  return { dca, instance };
};

export default useAftermath;