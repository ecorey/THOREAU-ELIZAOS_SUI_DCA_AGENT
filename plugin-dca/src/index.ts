import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";



// DEXSCREENER
import { dexscreenerProvider } from "./providers/dexscreenerProvider.ts";
import dexscreenerCall from "./actions/dexscreenerCall.ts";


// DCA
import { dcaProvider } from "./providers/dcaProvider.ts";
import createDca from "./actions/createDca.ts";



// BLUEFIN PROTOCOL
import {bluefinDataProvider} from "./providers/bluefinDataProvider.ts";
import { bluefinSwapProvider } from "./providers/bluefinSwapProvider.ts";

import bluefinFetchData from "./actions/bluefinFetchData.ts";
import bluefinSwap from "./actions/bluefinSwap.ts";



export { WalletProvider, transferToken as TransferSuiToken };

export const dcaPlugin: Plugin = {
    name: "dca",
    description: "DCA Plugin",
    actions: [
        transferToken,
        bluefinFetchData,
        bluefinSwap,
        // dexscreenerCall,
        createDca,
        // createDcaAction,
        
    ],
    evaluators: [],
    providers: [
        walletProvider,
        bluefinDataProvider,
        bluefinSwapProvider,
        // dexscreenerProvider,
        dcaProvider,
        // createDcaProvider, 
    ],
};

export default dcaPlugin;