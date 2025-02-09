// eggCheckByAddressProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import { SuiClient } from "@firefly-exchange/library-sui";

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
      console.log("Provider called with state:", state);
      
      if (!state?.address) {
        return JSON.stringify({
          success: false,
          error: "No address provided"
        });
      }

      const client = new SuiClient({ url: "https://fullnode.mainnet.sui.io:443" });
      
      // First, get the dynamic fields of the address
      const dynamicFields = await client.getDynamicFields({
        parentId: state.address
      });

      console.log("Dynamic fields for address:", dynamicFields);

      // Look for kiosk in dynamic fields
      let kioskFields = [];
      let wrapperFields = [];
      let eggFound = false;

      for (const field of dynamicFields.data || []) {
        // Check each dynamic field object
        const fieldObject = await client.getDynamicFieldObject({
          parentId: state.address,
          name: field.name
        });

        console.log("Field object:", field.name, fieldObject);

        // Check if this is a kiosk
        if (field.objectType?.includes("kiosk")) {
          // Get kiosk contents
          const kioskContents = await client.getDynamicFields({
            parentId: field.objectId
          });
          kioskFields = kioskContents.data;
          console.log("Kiosk contents:", kioskContents);

          // Check kiosk contents for wrapper or egg
          for (const item of kioskContents.data || []) {
            if (item.objectType?.includes("AfEgg") || 
                item.objectType?.includes("AfEggWrapper")) {
              eggFound = true;
              break;
            }
          }
        }

        // Check if this is a wrapper
        if (field.objectType?.includes("AfEggWrapper")) {
          const wrapperContents = await client.getDynamicFields({
            parentId: field.objectId
          });
          wrapperFields = wrapperContents.data;
          console.log("Wrapper contents:", wrapperContents);

          // Check wrapper contents for egg
          for (const item of wrapperContents.data || []) {
            if (item.objectType?.includes("AfEgg")) {
              eggFound = true;
              break;
            }
          }
        }

        // Direct egg check
        if (field.objectType?.includes("AfEgg")) {
          eggFound = true;
        }
      }

      const result = JSON.stringify({
        success: true,
        ownsEgg: eggFound,
        hasKiosk: kioskFields.length > 0,
        hasWrapper: wrapperFields.length > 0,
        kioskFieldCount: kioskFields.length,
        wrapperFieldCount: wrapperFields.length,
        address: state.address
      });

      console.log("Provider returning result:", result);
      return result;

    } catch (error: any) {
      console.error("Egg Ownership Check Error:", error);
      return JSON.stringify({
        success: false,
        error: error.message,
        details: error
      });
    }
  }
};