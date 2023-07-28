# Umbrella Network MultiversX Contracts

## Build

Need to have `mxpy` installed!

`npm run build` - builds StakingBankStaticLocal and UmbrellaFeeds

`npm run build:feeds`

`npm run build:bank:static:local`

`npm run build:bank:static:dev`

`npm run build:bank:static:prod`

`npm run build:all` - builds all the contracts from above

## Test

`npm run test`

`npm run test:all`

## Interactions

For running interactions you need to have a `wallet.json` file inside this repository. You can create one with

`xsuite new-wallet --wallet wallet.json`

Then use the appropriate command to interact with the contract on the appropriate network

`npm run interact:devnet [command]`

`npm run interact:testnet [command]`

`npm run interact:mainnet [command]`

To list available commands run:

`npm run interact:devnet help`

## Deploy & Upgrade

First, you need to build the appropriate contracts. You can run `npm run build:all` to build all of them. Then they can be deployed.

**The default number of required signatures is 1 and decimals is 8! These can be changed in the `interact/index.ts` file.**

`npm run interact:devnet deploy` - this will deploy the StakingBankStaticLocal and UmbrellaFeeds

`npm run interact:testnet deploy` - this will deploy the StakingBankStaticDev and UmbrellaFeeds

`npm run interact:mainnet deploy` - this will deploy the StakingBankStaticProd and UmbrellaFeeds

**After deploy make sure to add the contract addresses to the appropriate place in the `interact/data.json` file so further interact commands work properly!**

After the `interact/data.json` file is updated, and after you upgrade any code, you can easily upgrade the contracts with:

`npm run interact:devnet upgrade` - this will upgrade both the StakingBankStaticLocal and UmbrellaFeeds contracts 
