import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";



// AFTERMATH DCA
import { dcaProvider } from "./providers/dcaProvider.ts";
import createDca from "./actions/createDca.ts";


// AFTERMATH EGG
import { eggOwnershipProvider } from "./providers/eggCheckProvider.ts";
import eggCheck from "./actions/eggCheck.ts";



// BLUEFIN PROTOCOL
import { bluefinDataProvider } from "./providers/bluefinDataProvider.ts";
import { suiUsdcSwapProvider } from "./providers/suiUsdcSwapProvider.ts";
import { usdcSuiSwapProvider } from "./providers/usdcSuiSwapProvider.ts";


import bluefinFetchData from "./actions/bluefinFetchData.ts";
import suiUsdcSwap from "./actions/suiUsdcSwap.ts";
import usdcSuiSwap from "./actions/usdcSuiSwap.ts";



export { WalletProvider, transferToken as TransferSuiToken };

export const dcaPlugin: Plugin = {
    name: "dca",
    description: "DCA Plugin",
    actions: [
        transferToken,
        bluefinFetchData,
        suiUsdcSwap,
        usdcSuiSwap,
        createDca,
        eggCheck,   
    ],
    evaluators: [],
    providers: [
        walletProvider,
        bluefinDataProvider,
        suiUsdcSwapProvider,
        usdcSuiSwapProvider,
        dcaProvider,
        eggOwnershipProvider,
    ],
};

export default dcaPlugin;