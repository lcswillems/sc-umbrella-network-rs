import { afterEach, beforeEach, test } from "node:test";
import { assertAccount } from "xsuite/test";
import { FWorld, FWorldContract, FWorldWallet } from "xsuite/world";
import { e } from "xsuite/data";
import { Address } from "@multiversx/sdk-core"
import { BigUIntValue, BinaryCodec } from '@multiversx/sdk-core/out';
import createKeccakHash from "keccak";
import BigNumber from 'bignumber.js';
import fs from 'fs';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';

let fworld: FWorld;
let deployer: FWorldWallet;
let contractStakingBank: FWorldContract;
let addressStakingBank: string;
let contract: FWorldContract;
let address: string;

beforeEach(async () => {
  fworld = await FWorld.start();
});

afterEach(() => {
  fworld.terminate();
});

test("Test", async () => {
  deployer = await fworld.createWallet({ balance: 10_000_000_000n });

  ({ contract, address } = await deployer.deployContract({
    code: "file:staking-bank-static/staking-bank-static-local/output/staking-bank-static-local.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: []
  }));
  addressStakingBank = address;
  contractStakingBank = contract;

  ({ contract, address } = await deployer.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(addressStakingBank),
      e.U32(1),
      e.U8(8)
    ]
  }));

  let pairs = await contract.getAccountWithPairs();

  console.log('pairs', pairs);

  // console.log('mapper', e.p.SingleValueMapper('decimals', [[e.U8(0), e.U8(8)]]));

  assertAccount(pairs, {
    balance: 0n,
    hasPairs: [
      e.p.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.p.Mapper('required_signatures').Value(e.U32(1)),
      e.p.Mapper('decimals').Value(e.U8(8)),
    ],
  });

  console.log('address', address);

  const priceKey = createKeccakHash('keccak256').update('ETH-USD').digest('hex');

  console.log('ETH-USD price key hex', priceKey);

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10), // 10 with 8 decimals
  };

  const contractAddress = Address.fromBech32(address).pubkey();

  console.log('contract address', contractAddress);

  const codec = new BinaryCodec();

  // get_price_data_hash
  let data = Buffer.concat([
    contractAddress,

    // price_keys
    Buffer.from(priceKey, 'hex'),

    // price_datas
    Buffer.from(priceData.data.toString()),
    Buffer.from(priceData.hearbeat.toString()),
    Buffer.from(priceData.timestamp.toString()),
    codec.encodeTopLevel(new BigUIntValue(priceData.price)),
  ]);

  console.log('data to be signed', data);

  const dataHash = createKeccakHash('keccak256').update(data).digest();

  // console.log('price_data_hash to be signed', dataHash.toString());

  const file = fs.readFileSync('./alice.pem').toString();
  const privateKey = UserSecretKey.fromPem(file);

  // verify_signature
  const newData = Buffer.concat([
    Buffer.from("\x19MultiversX Signed Message:\n32"),
    Buffer.from(dataHash)
  ]);

  console.log('new data', newData);

  const newDataHash = createKeccakHash('keccak256').update(newData).digest();

  // console.log('verify signature hash new data', newDataHash.toString());

  const publicKey = privateKey.generatePublicKey();
  const signature = privateKey.sign(newDataHash);

  const { tx } = await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1),
      e.List(e.Bytes(Buffer.from(priceKey, 'hex'))),

      e.U32(1),
      e.List(e.Tuple(
        e.U8(priceData.data),
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      )),

      e.U32(1),
      e.List(e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      )),
    ],
  });

  console.log('transaction', tx);

  pairs = await contract.getAccountWithPairs();

  console.log('pairs', pairs);

  assertAccount(pairs, {
    balance: 0n,
    hasPairs: [
      e.p.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.p.Mapper('required_signatures').Value(e.U32(1)),
      e.p.Mapper('decimals').Value(e.U8(8)),

      e.p.Mapper('prices', e.Buffer(Buffer.from(priceKey, 'hex'))).Value(e.Tuple(
        e.U8(priceData.data),
        e.U32(priceData.hearbeat),
        e.U32(priceData.timestamp),
        e.U(priceData.price.toNumber()),
      )),
    ],
  });
});
