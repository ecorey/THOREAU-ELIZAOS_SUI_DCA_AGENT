
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Aftermath } from "aftermath-ts-sdk";
import useAftermath from "./useAftermath.ts"; 

export interface DcaActiveOrdersState extends State {
  walletAddress?: string;
  aftermathInstance?: Aftermath;
  dcaInstance?: any;
}

export interface DcaActiveOrdersProvider extends Provider {
  getActiveOrders: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DcaActiveOrdersState
  ) => Promise<string>;
}

export const dcaActiveOrdersProvider: DcaActiveOrdersProvider = {
  get: async () => {
    return "WARNING: dcaActiveOrdersProvider.get() is not implemented.";
  },

 
  getActiveOrders: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DcaActiveOrdersState
  ): Promise<string> => {
    try {
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) {
        throw new Error("SUI_PRIVATE_KEY_VAR environment variable is missing.");
      }

      let privateKeyBytes: Uint8Array;
      if (privateKeyVar.includes(",")) {
        privateKeyBytes = new Uint8Array(
          privateKeyVar.split(",").map((num) => parseInt(num.trim(), 10))
        );
      } else if (privateKeyVar.startsWith("0x")) {
        privateKeyBytes = Buffer.from(privateKeyVar.slice(2), "hex");
      } else {
        privateKeyBytes = Buffer.from(privateKeyVar, "base64");
      }

      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();
      console.log("[DCA ACTIVE ORDERS] walletAddress:", walletAddress);

      let dca;
      if (!state?.aftermathInstance || !state?.dcaInstance) {
        const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

        const minRequiredSui = BigInt(100_000_000); // 0.1 SUI
        const balance = await suiClient.getBalance({
          owner: walletAddress,
          coinType: "0x2::sui::SUI",
        });
        if (BigInt(balance.totalBalance) < minRequiredSui) {
          throw new Error(`Insufficient SUI for gas. Need 0.1 SUI, have ${balance.totalBalance}.`);
        }

        const { dca: newDca, instance } = await useAftermath(
          suiClient,
          walletAddress,
          async ({ message }) => {
            const signResult = await keypair.signPersonalMessage(message);
            return {
              signature: signResult.signature.startsWith("0x")
                ? signResult.signature.slice(2)
                : signResult.signature,
              bytes: new Uint8Array(
                signResult.bytes.split("").map((ch) => ch.charCodeAt(0))
              ),
            };
          }
        );
        dca = newDca;

        if (state) {
          state.dcaInstance = newDca;
          state.aftermathInstance = instance;
          state.walletAddress = walletAddress;
        }
      } else {
        dca = state.dcaInstance;
      }

      const activeOrders = await dca.getActiveDcaOrders({ walletAddress });
      console.log("[DCA ACTIVE ORDERS] found:", activeOrders.length);

      return JSON.stringify(activeOrders, null, 2);
    } catch (err: any) {
      console.error("[ERROR] dcaActiveOrdersProvider.getActiveOrders:", err);
      return `ERROR: ${err.message}`;
    }
  },
};
