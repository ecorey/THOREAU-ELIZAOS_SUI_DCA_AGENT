import { Aftermath } from "aftermath-ts-sdk";
import type { SuiClient } from "@mysten/sui/client";

let instance: Aftermath | null = null;

const useAftermath = async (
  client: SuiClient,
  walletAddress: string,
  signMessageCallback: (input: { message: Uint8Array }) => Promise<{ signature: string; bytes?: Uint8Array }>
) => {
  if (!instance) {
    console.log("✅ Initializing Aftermath SDK...");
    instance = new Aftermath("MAINNET");
    await instance.init();
  }

  const dca = instance.Dca();

  console.log("🔍 Checking for existing public key...");
  const userPublicKey = await dca.getUserPublicKey({ walletAddress });

  if (userPublicKey) {
    console.log("✅ User already has a public key:", userPublicKey);
    return { dca, instance };
  }

  console.log("❌ No public key found. Creating a new one...");
  try {
    const messageToSign = dca.createUserAccountMessageToSign();
    const messageBytes = new TextEncoder().encode(JSON.stringify(messageToSign));

    console.log("🔹 Signing message...");
    const signResult = await signMessageCallback({ message: messageBytes });

    if (!signResult.signature) {
      throw new Error("No signature generated");
    }

    const encodedMessage = Buffer.from(messageBytes).toString('base64');
    
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