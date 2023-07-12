import { World } from "xsuite/world";
import { e } from 'xsuite/data';
import BigNumber from 'bignumber.js';
import { Address, BigUIntValue, BinaryCodec } from '@multiversx/sdk-core/out';
import fs from 'fs';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import createKeccakHash from "keccak";

const contractStakingBankAddr: string = 'erd1qqqqqqqqqqqqqpgqta7gpchzrfqjywyqyqkcf246umtakkzfm40qszlvav';
const contractAddr: string = 'erd1qqqqqqqqqqqqqpgqcecmln94j74nphaqc42f9yjuv2kn4mvcm40q889qyh';

const generateSignature = (priceKeyRaw: string, priceData?: { data: number; price: BigNumber; hearbeat: number; timestamp: number }) => {
  const priceKey = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');
  const contractAddress = Address.fromBech32(contractAddr).pubkey();

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

  const contract = world.newContract(contractAddr)

  const priceData = {
    data: 0,
    hearbeat: 0,
    timestamp: 1688998114,
    price: new BigNumber(1000000000, 10),
  };

  const { priceKey, publicKey, signature } = generateSignature('ETH-USD', priceData);

  const tx = await wallet.callContract({
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

  console.log('transaction', tx);
};

main();
