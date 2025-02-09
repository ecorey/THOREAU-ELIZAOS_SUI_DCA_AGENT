
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
  // We won't implement 'get()' here, as we only need `getActiveOrders`.
  get: async () => {
    return "WARNING: dcaActiveOrdersProvider.get() is not implemented.";
  },

  /**
   * Main method: fetch active DCA orders only
   */
  getActiveOrders: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: DcaActiveOrdersState
  ): Promise<string> => {
    try {
      // 1) Grab private key from env
      const privateKeyVar = process.env.SUI_PRIVATE_KEY_VAR;
      if (!privateKeyVar) {
        throw new Error("SUI_PRIVATE_KEY_VAR environment variable is missing.");
      }

      // 2) Convert the private key
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

      // 3) Create keypair & wallet address
      const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.toSuiAddress();
      console.log("[DCA ACTIVE ORDERS] walletAddress:", walletAddress);

      // 4) If we don’t already have a dcaInstance, init it
      let dca;
      if (!state?.aftermathInstance || !state?.dcaInstance) {
        const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

        // (optional) check SUI gas balance
        const minRequiredSui = BigInt(100_000_000); // 0.1 SUI
        const balance = await suiClient.getBalance({
          owner: walletAddress,
          coinType: "0x2::sui::SUI",
        });
        if (BigInt(balance.totalBalance) < minRequiredSui) {
          throw new Error(`Insufficient SUI for gas. Need 0.1 SUI, have ${balance.totalBalance}.`);
        }

        // 5) Connect to Aftermath using your existing hook
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

        // store in state for reuse
        if (state) {
          state.dcaInstance = newDca;
          state.aftermathInstance = instance;
          state.walletAddress = walletAddress;
        }
      } else {
        // reuse existing
        dca = state.dcaInstance;
      }

      // 6) Finally, fetch active orders
      const activeOrders = await dca.getActiveDcaOrders({ walletAddress });
      console.log("[DCA ACTIVE ORDERS] found:", activeOrders.length);

      // return as JSON
      return JSON.stringify(activeOrders, null, 2);
    } catch (err: any) {
      console.error("[ERROR] dcaActiveOrdersProvider.getActiveOrders:", err);
      return `ERROR: ${err.message}`;
    }
  },
};
