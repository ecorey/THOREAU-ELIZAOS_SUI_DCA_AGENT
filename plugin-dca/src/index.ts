import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";



// DEXSCREENER
import { dexscreenerProvider } from "./providers/dexscreenerProvider.ts";
import dexscreenerCall from "./actions/dexscreenerCall.ts";




export { WalletProvider, transferToken as TransferSuiToken };

export const dcaPlugin: Plugin = {
    name: "dca",
    description: "DCA Plugin",
    actions: [
        transferToken,
        dexscreenerCall,
        
    ],
    evaluators: [],
    providers: [
        walletProvider,
        dexscreenerProvider, 
    ],
};

export default dcaPlugin;