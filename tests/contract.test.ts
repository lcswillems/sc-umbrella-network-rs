import { afterEach, beforeEach, expect, test } from "vitest";
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

  deployer = await fworld.createWallet({ balance: 10_000_000_000n });
});

afterEach(() => {
  fworld.terminate();
});

const deployStakingBank = async (path: string = 'staking-bank-static/staking-bank-static-local/output/staking-bank-static-local.wasm') => {
  const { contract, address } = await deployer.deployContract({
    code: `file:${ path }`,
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: []
  });

  addressStakingBank = address;
  contractStakingBank = contract;
}

const deployContract = async (addressStakingBank: string, requiredSignatures: number = 1) => {
  ({ contract, address } = await deployer.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(addressStakingBank),
      e.U32(requiredSignatures),
      e.U8(8)
    ]
  }));

  const pairs = await contract.getAccountWithPairs();
  assertAccount(pairs, {
    balance: 0n,
    hasPairs: [
      e.p.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.p.Mapper('required_signatures').Value(e.U32(requiredSignatures)),
      e.p.Mapper('decimals').Value(e.U8(8)),
    ],
  });
}

const generateSignature = (priceKeyRaw: string, priceData?: { data: number; price: BigNumber; hearbeat: number; timestamp: number }) => {
  const priceKey = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');
  const contractAddress = Address.fromBech32(address).pubkey();

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

test("Deploy and update valid signature", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'update',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
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

  const pairs = await contract.getAccountWithPairs();
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

test("Update not enough signatures", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank, 2);

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await expect(
    () => deployer.callContract({
      callee: contract,
      gasLimit: 10_000_000,
      funcName: 'update',
      funcArgs: [
        e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
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
    })
  ).rejects.toThrowError('Tx failed: 4 - Not enough signatures');
});

test("Update signatures out of order", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await expect(
    () => deployer.callContract({
      callee: contract,
      gasLimit: 10_000_000,
      funcName: 'update',
      funcArgs: [
        e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
        e.List(e.Bytes(Buffer.from(priceKey, 'hex'))),

        e.U32(1),
        e.List(e.Tuple(
          e.U8(priceData.data),
          e.U32(priceData.hearbeat),
          e.U32(priceData.timestamp),
          e.U(1), // wrong price
        )),

        e.U32(1),
        e.List(e.Tuple(
          e.Addr(publicKey.toAddress().bech32()),
          e.Bytes(signature),
        )),
      ],
    })
  ).rejects.toThrowError('Tx failed: 10 - invalid signature');
});

test("Update invalid signer", async () => {
  // Deploy other staking bank contract which doesn't have the public key of alice known
  await deployStakingBank('staking-bank/output/staking-bank.wasm');

  await deployContract(addressStakingBank);

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  await expect(
    () => deployer.callContract({
      callee: contract,
      gasLimit: 10_000_000,
      funcName: 'update',
      funcArgs: [
        e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
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
    })
  ).rejects.toThrowError('Tx failed: 4 - Invalid signer');
});

test("Deploy and reset valid signature", async () => {
  await deployStakingBank();

  await deployContract(addressStakingBank);

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD');

  await deployer.callContract({
    callee: contract,
    gasLimit: 10_000_000,
    funcName: 'reset',
    funcArgs: [
      e.U32(1), // Length of the list needed before because of use of MultiValueManagedVecCounted in contract
      e.List(e.Bytes(Buffer.from(priceKey, 'hex'))),

      e.U32(1),
      e.List(e.Tuple(
        e.Addr(publicKey.toAddress().bech32()),
        e.Bytes(signature),
      )),
    ],
  });

  const pairs = await contract.getAccountWithPairs();
  assertAccount(pairs, {
    balance: 0n,
    hasPairs: [
      e.p.Mapper('staking_bank').Value(e.Addr(addressStakingBank)),
      e.p.Mapper('required_signatures').Value(e.U32(1)),
      e.p.Mapper('decimals').Value(e.U8(8)),

      e.p.Mapper('prices', e.Buffer(Buffer.from(priceKey, 'hex'))).Value(e.Tuple(
        e.U8(255),
        e.U32(0),
        e.U32(0),
        e.U(0),
      )),
    ],
  });
});
