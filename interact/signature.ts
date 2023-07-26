import BigNumber from 'bignumber.js';
import { Address, BigUIntValue, BinaryCodec } from '@multiversx/sdk-core/out';
import fs from 'fs';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import createKeccakHash from "keccak";

export const generateSignature = (contractAddr: string, priceKeyRaw: string, priceData: { price: BigNumber; hearbeat: number; timestamp: number }) => {
  console.log('contract addr', contractAddr);

  const priceKey = createKeccakHash('keccak256').update(priceKeyRaw).digest('hex');
  const contractAddress = Address.fromBech32(contractAddr).pubkey();

  const codec = new BinaryCodec();

  // get_price_data_hash
  let data = Buffer.concat([
    contractAddress,

    // price_keys
    Buffer.from(priceKey, 'hex'),

    // price_datas
    Buffer.from(priceData.hearbeat.toString()),
    Buffer.from(priceData.timestamp.toString()),
    codec.encodeTopLevel(new BigUIntValue(priceData.price)),
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
