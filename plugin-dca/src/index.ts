import { Plugin } from "@elizaos/core";
import transferToken from "./actions/transfer.ts";
import { WalletProvider, walletProvider } from "./providers/wallet.ts";



// AFTERMATH DCA
import { dcaProvider } from "./providers/dcaProvider.ts";
import createDca from "./actions/createDca.ts";

import { dcaActiveOrdersProvider } from "./providers/dcaActiveOrdersProvider.ts";
import getActiveDcaOrders from "./actions/getActiveDcaOrders.ts";

import { dcaCancelProvider } from "./providers/dcaCancelProvider.ts";
import cancelDcaOrder from "./actions/cancelDcaOrder.ts";



// AFTERMATH EGG
import { checkEggOwnershipByAddressProvider } from "./providers/eggCheckByAddressProvider.ts";
import eggCheckByAddress from "./actions/eggCheckByAddress.ts";



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
        // bluefinFetchData,
        // suiUsdcSwap,
        // usdcSuiSwap,
        createDca,
        getActiveDcaOrders,
        cancelDcaOrder,
        // eggCheckByAddress,   
    ],
    evaluators: [],
    providers: [
        walletProvider,
        // bluefinDataProvider,
        // suiUsdcSwapProvider,
        // usdcSuiSwapProvider,
        dcaProvider,
        dcaActiveOrdersProvider,
        dcaCancelProvider,
        // checkEggOwnershipByAddressProvider,
    ],
};

export default dcaPlugin;