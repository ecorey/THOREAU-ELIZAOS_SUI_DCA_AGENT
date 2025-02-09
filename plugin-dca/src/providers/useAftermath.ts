import { Aftermath } from "aftermath-ts-sdk";
import type { SuiClient } from "@mysten/sui.js/client";

let instance: Aftermath | null = null; 

const useAftermath = async (
  client: SuiClient,
  walletAddress: string,
  signMessageCallback: (input: { message: Uint8Array }) => Promise<{ signature: string }>
) => {
  if (!instance) {
    console.log("✅ Initializing Aftermath SDK...");
    instance = new Aftermath("MAINNET");
    await instance.init();
  }

  const dca = instance.Dca();

  console.log("🔍 Checking for existing public key...");
  const userPublicKey = await dca.getUserPublicKey({ walletAddress });

  if (!userPublicKey) {
    console.log("❌ No public key found. Creating a new one...");
    try {
      const messageToSign = dca.createUserAccountMessageToSign();
      const messageBytes = new TextEncoder().encode(JSON.stringify(messageToSign));
      
      console.log("🔹 Signing message...");
      const { signature } = await signMessageCallback({ message: messageBytes });

      if (!signature || signature.length === 0) {
        throw new Error("Generated signature is empty! Possible signing issue.");
      }

      const encodedSignature = Buffer.from(signature, "hex").toString("base64");
      const encodedMessage = Buffer.from(messageBytes).toString("base64");

      console.log("🔹 Signed message:", encodedMessage);
      console.log("🔹 Encoded signature:", encodedSignature);

      const success = await dca.createUserPublicKey({
        walletAddress,
        bytes: encodedMessage,
        signature: encodedSignature,
      });

      if (success) {
        console.log("✅ Successfully created user public key!");
      } else {
        throw new Error("❌ Failed to create user public key.");
      }
    } catch (error) {
      console.error("❌ Error creating user public key:", error);
      throw error;
    }
  } else {
    console.log("✅ User already has a public key:", userPublicKey);
  }

  return { dca };
};


export default useAftermath;
