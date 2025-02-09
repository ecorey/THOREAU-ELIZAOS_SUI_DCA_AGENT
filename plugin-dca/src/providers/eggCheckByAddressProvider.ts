import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient, Ed25519Keypair } from "@firefly-exchange/library-sui";

export interface EggCheckByAddressState extends State {
  address?: string; 
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

      const kioskId = state.address;
      console.log("Checking kiosk:", kioskId);

      const client = new SuiClient({
        url: "https://fullnode.mainnet.sui.io:443",
      });

      const privateKeyArray = process.env.SUI_PRIVATE_KEY_VAR?.split(",").map(Number);
      if (!privateKeyArray) {
        throw new Error("SUI_PRIVATE_KEY_VAR is not set or invalid");
      }
      const keyPair = Ed25519Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      const localWalletAddress = keyPair.toSuiAddress();
      console.log("Local wallet address:", localWalletAddress);

      const kioskObjectRes = await client.getObject({
        id: kioskId,
        options: {
          showOwner: true,   
          showContent: true, 
        },
      });

      if (!kioskObjectRes.data) {
        return JSON.stringify({
          success: false,
          error: `Kiosk ${kioskId} not found`,
        });
      }

      let kioskOwnerField: string | null = null;
      const kioskOwnerInfo = kioskObjectRes.data.owner; 

      const content = kioskObjectRes.data.content;
      if (content && content.dataType === "moveObject") {
        const fields = content.fields as { owner?: string };
        
        if (fields.owner && typeof fields.owner === "string") {
          kioskOwnerField = fields.owner;
        }
      }

      console.log("Kiosk Sui owner info:", kioskOwnerInfo);
      console.log("Kiosk 'owner' field in Move struct:", kioskOwnerField);

      const isOwner =
        kioskOwnerField &&
        kioskOwnerField.toLowerCase() === localWalletAddress.toLowerCase();

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
