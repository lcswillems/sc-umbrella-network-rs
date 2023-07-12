import { afterEach, beforeEach, test } from "node:test";
import { assertAccount } from "xsuite/test";
import { FWorld, FWorldContract, FWorldWallet } from "xsuite/world";
import { e } from "xsuite/data";

let fworld: FWorld;
let deployer: FWorldWallet;
let contractStakingBank: FWorldContract;
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
  contractStakingBank = contract;

  ({ contract } = await deployer.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(address),
      e.U32(1),
      e.U8(8)
    ]
  }));

  const pairs = await contract.getAccountWithPairs();

  console.log('pairs', pairs);

  // console.log('mapper', e.p.SingleValueMapper('decimals', [[e.U8(0), e.U8(8)]]));

  assertAccount(pairs, {
    balance: 0n,
    hasPairs: [
      e.p.Mapper('staking_bank').Value(e.Addr(address)),
      e.p.Mapper('required_signatures').Value(e.U32(1)),
      e.p.Mapper('decimals').Value(e.U8(8)),
    ],
  });

  // const { tx } = await deployer.callContract({
  //   callee: contract,
  //   gasLimit: 10_000_000,
  //   funcName: 'update',
  //   funcArgs: [
  //     e.List(e.Buffer(Buffer.from('2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7', 'hex'))),
  //     e.List(e.Tuple(
  //       e.U8(0),
  //       e.U32(0),
  //       e.U32(1688998114),
  //       e.U(1000000000),
  //     )),
  //     e.List(e.Tuple(
  //       e.Addr('erd1qyu5wthldzr8wx5c9ucg8kjagg0jfs53s8nr3zpz3hypefsdd8ssycr6th'),
  //       e.Bytes(Buffer.from('89657df3e35a4f34c758ea228c1cb6fc4789c109b04d0cbd7d562483de8a640a4a18a07f6f772ce53ab868d4fa0509c7ff2934b08fd93dd35f4784963453610f', 'hex')),
  //     )),
  //   ],
  // });

  // console.log('transaction', tx);
});
