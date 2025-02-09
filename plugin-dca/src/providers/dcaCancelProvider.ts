// file: plugin-dca/src/providers/dcaCancelProvider.ts

import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Aftermath } from "aftermath-ts-sdk";
import useAftermath from "./useAftermath.ts";

export interface DcaCancelState extends State {
  walletAddress?: string;
  aftermathInstance?: Aftermath;
  dcaInstance?: any;
}

export interface DcaCancelProvider extends Provider {
  cancelDcaOrder: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DcaCancelState
  ) => Promise<string>;
}

export const dcaCancelProvider: DcaCancelProvider = {
  // Not implementing get() here, we only need cancelDcaOrder:
  get: async () => "WARNING: dcaCancelProvider.get() not implemented.",

  /**
   * Cancels a single DCA order by object ID
   */
  cancelDcaOrder: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DcaCancelState
  ): Promise<string> => {
    try {
      // 1) If we don't have a dcaInstance in state, re-init it:
      if (!state?.dcaInstance || !state?.walletAddress) {
        console.log("[DCA-CANCEL] Re-initializing Aftermath...");
        const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
        if (!privateKeyVar) {
          throw new Error("No SUI_PRIVATE_KEY_VAR found");
        }

        // Parse the private key
        let pkBytes: Uint8Array;
        if (privateKeyVar.includes(",")) {
          pkBytes = new Uint8Array(
            privateKeyVar.split(",").map((x) => parseInt(x.trim(), 10))
          );
        } else if (privateKeyVar.startsWith("0x")) {
          pkBytes = Buffer.from(privateKeyVar.slice(2), "hex");
        } else {
          pkBytes = Buffer.from(privateKeyVar, "base64");
        }
        const keypair = Ed25519Keypair.fromSecretKey(pkBytes);

        // Create a Sui client
        const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
        const walletAddress = keypair.toSuiAddress();

        // Use your existing 'useAftermath' hook
        const { dca, instance } = await useAftermath(client, walletAddress, async ({ message }) => {
          const signResult = await keypair.signPersonalMessage(message);
          return {
            signature: signResult.signature.startsWith("0x")
              ? signResult.signature.slice(2)
              : signResult.signature,
            bytes: new Uint8Array(
              signResult.bytes.split("").map((ch) => ch.charCodeAt(0))
            ),
          };
        });

        if (state) {
          state.walletAddress = walletAddress;
          state.aftermathInstance = instance;
          state.dcaInstance = dca;
        }
      }

      // 2) Now we have a valid dcaInstance + walletAddress
      const { dcaInstance, walletAddress } = state!;
      const dca = dcaInstance;

      // 3) Parse user text to find e.g. "cancel dca 0xf6d51dbe8..."
      const text = (message.content?.text || "").toLowerCase();
      console.log("[DCA-CANCEL] User text:", text);

      // We'll look for '0x' and 64 hex digits, e.g. 0x + 64 = 66 total
      const orderIdMatch = text.match(/0x[a-fA-F0-9]{40,}/);
      if (!orderIdMatch) {
        throw new Error("No valid '0x...' order ID found in user text");
      }
      const orderId = orderIdMatch[0];
      console.log("[DCA-CANCEL] Canceling order:", orderId);

      // 4) Generate a close message from the Aftermath DCA instance
      const closeMsg = dca.closeDcaOrdersMessageToSign({
        orderIds: [orderId],
      });

      // 5) We must sign that message with our private key
      const keyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!keyVar) {
        throw new Error("Missing SUI_PRIVATE_KEY_VAR at sign time");
      }
      let pkBytes: Uint8Array;
      if (keyVar.includes(",")) {
        pkBytes = new Uint8Array(
          keyVar.split(",").map((x) => parseInt(x.trim(), 10))
        );
      } else if (keyVar.startsWith("0x")) {
        pkBytes = Buffer.from(keyVar.slice(2), "hex");
      } else {
        pkBytes = Buffer.from(keyVar, "base64");
      }
      const keypair = Ed25519Keypair.fromSecretKey(pkBytes);

      // Convert the closeMsg to bytes
      const closeMsgBytes = new TextEncoder().encode(
        JSON.stringify(closeMsg)
      );
      // Sign it
      const signRes = await keypair.signPersonalMessage(closeMsgBytes);

      // Format the signature + message as required by dca.closeDcaOrder
      const signature = signRes.signature.startsWith("0x")
        ? signRes.signature.slice(2)
        : signRes.signature;
      const encodedMsg = Buffer.from(
        JSON.stringify(closeMsg),
        "utf-8"
      ).toString("base64");

      // 6) Actually perform the close
      const success = await dca.closeDcaOrder({
        walletAddress,
        bytes: encodedMsg,
        signature,
      });

      if (!success) {
        throw new Error("closeDcaOrder returned false (order not closed).");
      }

      console.log("[DCA-CANCEL] Successfully canceled:", orderId);
      return `SUCCESS: DCA order ${orderId} canceled.`;
    } catch (err: any) {
      console.error("[DCA-CANCEL] Error:", err);
      return `ERROR: ${err.message}`;
    }
  },
};
