import { Command } from "commander";
import { envChain } from "xsuite/interact";
import { World } from "xsuite/world";
// @ts-ignore
import data from "./data.json";
import { e, d } from "xsuite/data"
import BigNumber from 'bignumber.js';
import { generateSignature } from './signature';

const world = World.new({
  proxyUrl: envChain.publicProxyUrl(),
  chainId: envChain.id(),
  gasPrice: 1000000000,
});

export const loadWallet = () => world.newWalletFromFile("wallet.json");

const program = new Command();

program.command("deploy").action(async () => {
  const wallet = await loadWallet();
  const resultStakingBank = await wallet.deployContract({
    code: envChain.select(data.stakingBankCode),
    codeMetadata: [],
    gasLimit: 100_000_000,
  });
  console.log(resultStakingBank);

  const result = await wallet.deployContract({
    code: data.code,
    codeMetadata: ["upgradeable"],
    gasLimit: 100_000_000,
    codeArgs: [
      e.Addr(resultStakingBank.address),
      e.U32(1), // required signatures
      e.U8(8) // prices decimals
    ]
  });
  console.log("Result:", result);
});

program.command("upgrade").action(async () => {
  const wallet = await loadWallet();
  const result = await wallet.upgradeContract({
    callee: envChain.select(data.address),
    code: data.code,
    codeMetadata: ["upgradeable"],
    gasLimit: 100_000_000,
    codeArgs: [
      e.Addr(envChain.select(data.stakingBankAddress)),
      e.U32(1),
      e.U8(8)
    ],
  });
  console.log("Result:", result);
});

program.command("ClaimDeveloperRewards").action(async () => {
  const wallet = await loadWallet();
  const result = await wallet.callContract({
    callee: envChain.select(data.address),
    funcName: "ClaimDeveloperRewards",
    gasLimit: 10_000_000,
  });
  console.log("Result:", result);
});

program.command("update")
  .argument('[hearbeat]', 'data', 0)
  .argument('[timestamp]', 'data', 1688998114)
  .argument('[price]', 'data', 1000000000)
  .action(async (hearbeat: number, timestamp: number, price: number) => {
  const wallet = await loadWallet();

  const priceData = {
    hearbeat,
    timestamp,
    price: new BigNumber(price, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature(envChain.select(data.address), 'ETH-USD', priceData);

  const tx = await wallet.callContract({
    callee: envChain.select(data.address),
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.List(e.Bytes(Buffer.from(priceKey, 'hex'))),

      e.U32(1),
      e.List(e.Tuple(
        e.U32(BigInt(priceData.hearbeat)),
        e.U32(BigInt(priceData.timestamp)),
        e.U(BigInt(priceData.price.toNumber())),
      )),

      e.U32(1),
      e.List(e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      )),
    ],
  });

  console.log('transaction', tx);
});



program.command("getPriceDataByName")
  .argument('[name]', 'Name of price to get', 'ETH-USD')
  .action(async (name: string) => {
    const { returnData } = await world.query({
      callee: envChain.select(data.address),
      funcName: "getPriceDataByName",
      funcArgs: [e.Str(name)],
    });

    const contractPriceData = d.Tuple({
      heartbeat: d.U32(),
      timestamp: d.U32(),
      price: d.U(),
    }).topDecode(returnData[0]);

    console.log('price data for ETH-USD', contractPriceData);
  });

program.command("updateSdkCore").action(async () => {
  const wallet = await loadWallet();

  const { returnData } = await world.query({
    callee: envChain.select(data.address),
    funcName: "getPriceDataByName",
    funcArgs: [e.Str("ETH-USD")],
  });

  const contractPriceData = d.Tuple({
    heartbeat: d.U32(),
    timestamp: d.U32(),
    price: d.U(),
  }).topDecode(returnData[0]);

  console.log('price data for ETH-USD', contractPriceData);

  // Try and send update transaction
  const priceData = {
    hearbeat: 0,
    timestamp: 1688998115,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature(envChain.select(data.address), 'ETH-USD', priceData);

  const { tx } = await wallet.callContract({
    callee: envChain.select(data.address),
    funcName: "update",
    funcArgs: [
      e.U32(1),
      e.List(e.Bytes(priceKey)),
      e.U32(1),
      e.List(e.Tuple(e.U32(priceData.hearbeat), e.U32(priceData.timestamp), e.U(BigInt(priceData.price.toString())))),
      e.U32(1),
      e.List(e.Bytes(Buffer.concat([publicKey.valueOf(), signature]))),
    ],
    gasLimit: 20_000_000,
  });

  console.log('transaction', tx);
});

program.parse(process.argv);
