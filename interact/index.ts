import { Command } from "commander";
import { envChain } from "xsuite/interact";
import { World } from "xsuite/world";
// @ts-ignore
import data from "./data.json";
import { e } from "xsuite/data"
import { Address, ResultsParser, SmartContract } from "@multiversx/sdk-core";
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers/out';
import BigNumber from 'bignumber.js';
import { generateSignature } from './signature';
import {
  BigUIntType,
  BigUIntValue,
  BinaryCodec,
  BytesValue,
  ContractFunction,
  FieldDefinition,
  Interaction,
  StringValue,
  StructType,
  Transaction,
  Tuple,
  U32Type,
  U32Value,
  VariadicValue
} from '@multiversx/sdk-core/out';
import { Signature } from '@multiversx/sdk-core/out/signature';

const world = World.new({
  proxyUrl: envChain.publicProxyUrl(),
  chainId: envChain.id(),
  gasPrice: 1000000000,
});

export const loadWallet = () => world.newWalletFromFile("wallet.json");

const program = new Command();

program.command("deploy").action(async () => {
  const wallet = await loadWallet();

  console.log('Deploying Staking Bank contract...');

  const resultStakingBank = await wallet.deployContract({
    code: envChain.select(data.stakingBankCode),
    codeMetadata: ["upgradeable"],
    gasLimit: 100_000_000,
  });
  console.log('Staking Bank Result', resultStakingBank);

  console.log('Deploying Umbrella Feeds contract...');

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
  console.log("Umbrella Feeds Result:", result);

  console.log('Staking Bank Address:', resultStakingBank.address);
  console.log('Umbrella Feeds Address:', result.address);
});

program.command("upgrade").action(async () => {
  const wallet = await loadWallet();

  console.log('Upgrading Staking Bank contract...');

  const resultStakingBank = await wallet.upgradeContract({
    callee: envChain.select(data.stakingBankAddress),
    code: envChain.select(data.stakingBankCode),
    codeMetadata: ["upgradeable"],
    gasLimit: 100_000_000,
  });
  console.log('Staking Bank Result', resultStakingBank);

  console.log('Upgrading Umbrella Feeds contract...');

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
  console.log("Umbrella Feeds Result:", result);

  console.log('Staking Bank Address:', resultStakingBank.address);
  console.log('Umbrella Feeds Address:', result.address);
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
    const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

    const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

    const query = new Interaction(contract, new ContractFunction('getPriceDataByName'), [new StringValue(name)])
      .buildQuery();
    const response = await proxy.queryContract(query);
    const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

    const codec = new BinaryCodec();
    const structType = new StructType('PriceData', [
      new FieldDefinition('heartbeat', '', new U32Type()),
      new FieldDefinition('timestamp', '', new U32Type()),
      new FieldDefinition('price', '', new BigUIntType()),
    ]);
    const [decoded] = codec.decodeNested(parsedResponse.values[0], structType);
    const decodedAttributes = decoded.valueOf();

    const contractPriceData = {
      hearbeat: decodedAttributes.hearbeat.toNumber(),
      timestamp: decodedAttributes.timestamp.toNumber(),
      price: decodedAttributes.price.toNumber(),
    }

    console.log('price data for ETH-USD', contractPriceData);
  });

program.command("updateSdkCore").action(async () => {
  const wallet = await loadWallet();

  const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

  const account = await proxy.getAccount(Address.fromBech32(wallet.toString()));

  const contract = new SmartContract({ address: Address.fromBech32(envChain.select(data.address)) });

  const query = new Interaction(contract, new ContractFunction('getPriceDataByName'), [new StringValue('ETH-USD')])
    .buildQuery();
  const response = await proxy.queryContract(query);
  const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

  const codec = new BinaryCodec();
  const structType = new StructType('PriceData', [
    new FieldDefinition('heartbeat', '', new U32Type()),
    new FieldDefinition('timestamp', '', new U32Type()),
    new FieldDefinition('price', '', new BigUIntType()),
  ]);
  const [decoded] = codec.decodeNested(parsedResponse.values[0], structType);
  const decodedAttributes = decoded.valueOf();

  const contractPriceData = {
    hearbeat: decodedAttributes.hearbeat.toNumber(),
    timestamp: decodedAttributes.timestamp.toNumber(),
    price: decodedAttributes.price.toNumber(),
  }

  console.log('price data for ETH-USD', contractPriceData);

  // Try and send update transaction
  const priceData = {
    hearbeat: 0,
    timestamp: 1688998115,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature(envChain.select(data.address), 'ETH-USD', priceData);

  const updateInteraction = new Interaction(contract, new ContractFunction('update'), [
    new U32Value(1),
    VariadicValue.fromItems(new BytesValue(Buffer.from(priceKey, 'hex'))),

    new U32Value(1),
    VariadicValue.fromItems(Tuple.fromItems([
      new U32Value(priceData.hearbeat),
      new U32Value(priceData.timestamp),
      new BigUIntValue(priceData.price),
    ])),

    new U32Value(1),
    VariadicValue.fromItems(
      new BytesValue(Buffer.concat([publicKey.valueOf(), signature]))
    )
  ]);

  const transaction: Transaction = updateInteraction
    .withSender(account.address)
    .withNonce(account.nonce)
    .withValue(0)
    .withGasLimit(20_000_000)
    .withChainID('D')
    .buildTransaction();

  const toSign = transaction.serializeForSigning();
  const txSignature = await wallet.sign(toSign);

  transaction.applySignature(Signature.fromBuffer(txSignature));

  console.log('data', transaction.getData().toString('hex'));

  const hash = await proxy.sendTransaction(transaction);

  console.log('transaction hash', hash);
});

program.parse(process.argv);