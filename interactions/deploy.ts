import { World } from "xsuite/world";
import { e } from 'xsuite/data';

const main = async () => {
  const world = World.new({
    proxyUrl: "https://devnet-gateway.multiversx.com",
    chainId: "D",
    gasPrice: 1000000000,
  });
  const wallet = await world.newWalletFromFile("wallet.json");
  const txResultStakingBank = await wallet.deployContract({
    code: "file:staking-bank-static/staking-bank-static-local/output/staking-bank-static-local.wasm",
    codeMetadata: [],
    gasLimit: 100_000_000,
  });
  console.log(txResultStakingBank);

  const txResultFeeds = await wallet.deployContract({
    code: "file:umbrella-feeds/output/umbrella-feeds.wasm",
    codeMetadata: [],
    gasLimit: 100_000_000,
    codeArgs: [
      e.Addr(txResultStakingBank.address),
      e.U32(1),
      e.U8(8)
    ]
  });
  console.log(txResultFeeds);
};

main();
