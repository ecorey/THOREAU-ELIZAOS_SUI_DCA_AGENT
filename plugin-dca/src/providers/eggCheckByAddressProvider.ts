import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient, Ed25519Keypair } from "@firefly-exchange/library-sui";

export interface EggCheckByAddressState extends State {
  address?: string; // We'll reuse this for kiosk ID
}

export const checkEggOwnershipByAddressProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: EggCheckByAddressState
  ): Promise<string> => {
    try {
      if (!state?.address) {
        return JSON.stringify({
          success: false,
          error: "No kiosk ID provided",
        });
      }

      // Interpret 'address' as kioskId
      const kioskId = state.address;
      console.log("Checking kiosk:", kioskId);

      const client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
      });

      // 1. Load local keypair from environment
      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR?.split(",").map(Number);
      if (!privateKeyArray) {
        throw new Error("SUI_PRIVATE_KEY_VAR is not set or invalid");
      }
      const keyPair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      const localWalletAddress = keyPair.toSuiAddress();
      console.log("Local wallet address:", localWalletAddress);

      // 2. Get the kiosk object with its Move fields
      const kioskObjectRes = await client.getObject({
        id: kioskId,
        options: {
          showOwner: true,   // We want to see if it's Shared or AddressOwner, etc.
          showContent: true, // So we can read the kiosk's fields
        },
      });

      if (!kioskObjectRes.data) {
        return JSON.stringify({
          success: false,
          error: `Kiosk ${kioskId} not found`,
        });
      }

      // The kiosk might be shared, but let's see if it has an "owner" field in its Move struct
      let kioskOwnerField: string | null = null;
      const kioskOwnerInfo = kioskObjectRes.data.owner; // e.g. { Shared: { ... } } or { AddressOwner: "0x..." }

      // If it's a move object, we can read its fields
      const content = kioskObjectRes.data.content;
      if (content && content.dataType === "moveObject") {
        const fields = content.fields as { owner?: string };
        // Adjust the property name ("owner") to match your actual kiosk's Move definition
        if (fields.owner && typeof fields.owner === "string") {
          kioskOwnerField = fields.owner;
        }
      }

      console.log("Kiosk Sui owner info:", kioskOwnerInfo);
      console.log("Kiosk 'owner' field in Move struct:", kioskOwnerField);

      // 3. Compare kiosk's Move-level owner address to localWalletAddress
      const isOwner =
        kioskOwnerField &&
        kioskOwnerField.toLowerCase() === localWalletAddress.toLowerCase();

      // 4. Check if the kiosk has an AfEgg
      const dynamicFieldsRes = await client.getDynamicFields({
        parentId: kioskId,
      });
      let hasEgg = false;

      for (const field of dynamicFieldsRes.data) {
        const fieldObjRes = await client.getDynamicFieldObject({
          parentId: kioskId,
          name: field.name,
        });
        const fieldType = fieldObjRes?.data?.type ?? "";

        if (fieldType.includes("AfEgg")) {
          hasEgg = true;
          break;
        }
      }

      // 5. Return the final result
      const result = {
        success: true,
        kioskId,
        kioskSuiOwner: kioskOwnerInfo,
        kioskOwnerField,
        localWalletAddress,
        isOwner,
        hasEgg,
      };

      console.log("Provider returning:", result);
      return JSON.stringify(result);

    } catch (error: any) {
      console.error("Kiosk Egg Check Error:", error);
      return JSON.stringify({
        success: false,
        error: error.message,
        details: error,
      });
    }
  },
};
