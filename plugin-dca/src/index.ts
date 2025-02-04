import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";



// DEXSCREENER
import { dexscreenerProvider } from "./providers/dexscreenerProvider.ts";
import dexscreenerCall from "./actions/dexscreenerCall.ts";


// DCA
import { createDcaProvider } from "./providers/createDcaProvider.ts";
import createDcaAction from "./actions/createDca.ts";




export { WalletProvider, transferToken as TransferSuiToken };

export const dcaPlugin: Plugin = {
    name: "dca",
    description: "DCA Plugin",
    actions: [
        transferToken,
        dexscreenerCall,
        // createDcaAction,
        
    ],
    evaluators: [],
    providers: [
        walletProvider,
        dexscreenerProvider,
        // createDcaProvider, 
    ],
};

export default dcaPlugin;