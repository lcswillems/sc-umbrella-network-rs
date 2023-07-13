import BigNumber from 'bignumber.js';
import {
  AbiRegistry,
  Address,
  AddressValue, BigUIntType,
  BigUIntValue,
  BinaryCodec,
  BytesValue,
  CompositeValue,
  ContractFunction, FieldDefinition,
  Interaction,
  ResultsParser,
  SmartContract,
  StringValue,
  StructType,
  Transaction,
  TransactionPayload,
  Tuple, U32Type,
  U32Value,
  U64Value, U8Type,
  U8Value,
  VariadicValue
} from '@multiversx/sdk-core/out';
import fs from 'fs';
import { UserSecretKey, UserWallet } from '@multiversx/sdk-wallet/out';
import createKeccakHash from "keccak";
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers'
import { World } from 'xsuite/world';
import { Signature } from '@multiversx/sdk-core/out/signature';

const walletAddr: Address = Address.fromBech32('erd1y2jzfmez35yu34t20ewg7v3nv4xfm9kxwrcz24jaypfvrpwdm40q5tzd8c');
const contractAddr: Address = Address.fromBech32('erd1qqqqqqqqqqqqqpgqrsd3cyq9frnmc39ykqcj8r66eysqphnzm40qay48e3');

const generateSignature = (priceKeyRaw: string, priceData?: { data: number; price: BigNumber; hearbeat: number; timestamp: number }) => {
  const priceKey = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');
  const contractAddress = Address.fromBech32(contractAddr.bech32()).pubkey();

  const codec = new BinaryCodec();

  // get_price_data_hash
  let data = Buffer.concat([
    contractAddress,

    // price_keys
    Buffer.from(priceKey, 'hex'),

    ...(priceData ? [
      // price_datas
      Buffer.from(priceData.data.toString()),
      Buffer.from(priceData.hearbeat.toString()),
      Buffer.from(priceData.timestamp.toString()),
      codec.encodeTopLevel(new BigUIntValue(priceData.price)),
    ] : [Buffer.from('RESET')]),
  ]);

  const dataHash = createKeccakHash('keccak256').update(data).digest();

  const file = fs.readFileSync('./alice.pem').toString();
  const privateKey = UserSecretKey.fromPem(file);

  // verify_signature
  const newData = Buffer.concat([
    Buffer.from("\x19MultiversX Signed Message:\n32"),
    Buffer.from(dataHash)
  ]);

  const newDataHash = createKeccakHash('keccak256').update(newData).digest();

  const publicKey = privateKey.generatePublicKey();

  const signature = privateKey.sign(newDataHash);

  return { priceKey, publicKey, signature };
}

const main = async () => {
  const world = World.new({
    proxyUrl: "https://devnet-gateway.multiversx.com",
    chainId: "D",
    gasPrice: 1000000000,
  });
  const wallet = await world.newWalletFromFile("wallet.json");

  const proxy = new ProxyNetworkProvider('https://devnet-gateway.multiversx.com');

  const account = await proxy.getAccount(walletAddr);

  const contract = new SmartContract({ address: contractAddr });

  const query = new Interaction(contract, new ContractFunction('getPriceDataByName'), [new StringValue('ETH-USD')])
    .buildQuery();
  const response = await proxy.queryContract(query);
  const parsedResponse = new ResultsParser().parseUntypedQueryResponse(response);

  const codec = new BinaryCodec();
  const structType = new StructType('PriceData', [
    new FieldDefinition('data', '', new U8Type()),
    new FieldDefinition('heartbeat', '', new U32Type()),
    new FieldDefinition('timestamp', '', new U32Type()),
    new FieldDefinition('price', '', new BigUIntType()),
  ]);
  const [decoded] = codec.decodeNested(parsedResponse.values[0], structType);
  const decodedAttributes = decoded.valueOf();

  const contractPriceData = {
    data: decodedAttributes.data.toNumber(),
    hearbeat: decodedAttributes.data.toNumber(),
    timestamp: decodedAttributes.timestamp.toNumber(),
    price: decodedAttributes.price.toNumber(),
  }

  console.log('price data for ETH-USD', contractPriceData);

  // Try and send update transaction
  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998115,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  const updateInteraction = new Interaction(contract, new ContractFunction('update'), [
    new U32Value(1),
    VariadicValue.fromItems(new BytesValue(Buffer.from(priceKey, 'hex'))),

    new U32Value(1),
    VariadicValue.fromItems(Tuple.fromItems([
      new U8Value(priceData.data),
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

  // const hash = await proxy.sendTransaction(transaction);

  // console.log('transaction hash', hash);
};

main();
