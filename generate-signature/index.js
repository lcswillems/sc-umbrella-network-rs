import { UserSecretKey } from '@multiversx/sdk-wallet';
import * as fs from 'fs';
import createKeccakHash from "keccak";
import { Address } from "@multiversx/sdk-core"
import BigNumber from "bignumber.js";
import { BigUIntValue, BinaryCodec } from "@multiversx/sdk-core"

const file = fs.readFileSync('./test-signer.pem').toString();
const privateKey = UserSecretKey.fromPem(file);

const publicKey = privateKey.generatePublicKey();

console.log('public key hex', publicKey.hex());

const priceKey = createKeccakHash('keccak256').update('ETH-USD').digest('hex');

console.log('ETH-USD hash hex', priceKey);

const priceData = {
  data: 0,
  hearbeat: 0,
  timestamp: 1688998114,
  price: new BigNumber(1000000000, 10), // 10 with 8 decimals
};

// contract address: H256([0, 0, 0, 0, 0, 0, 0, 0, 251, 19, 151, 232, 34, 94, 168, 94, 15, 14, 110, 140, 123, 18, 109, 0, 22, 204, 189, 224, 230, 103, 21, 30])
const contractAddress = Address.fromBuffer(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 251, 19, 151, 232, 34, 94, 168, 94, 15, 14, 110, 140, 123, 18, 109, 0, 22, 204, 189, 224, 230, 103, 21, 30])).pubkey();

console.log('contract address', contractAddress);

const codec = new BinaryCodec();

let data = Buffer.concat([
  contractAddress,

  Buffer.from(priceKey, 'hex'),

  Buffer.from(priceData.data.toString()),
  Buffer.from(priceData.hearbeat.toString()),
  Buffer.from(priceData.timestamp.toString()),
  codec.encodeNested(new BigUIntValue(priceData.price)),
]).toString('hex');

console.log('data to be signed', data);

const dataHash = createKeccakHash('keccak256').update(data).digest('hex');

console.log('data hash to be signed', dataHash);

const newData = Buffer.concat([
  Buffer.from("\x19MultiversX Signed Message:\\n32"),
  Buffer.from(dataHash)
]).toString('hex');

console.log('new data', newData);

const newDataHash = createKeccakHash('keccak256').update(newData).digest('hex');

console.log('new data hash', newDataHash);

// TODO: Generate secp256k1 signature

//
// const signature = privateKey.sign(
//   Buffer.concat([
//     Buffer.from('6d795f616464726573735F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F', 'hex'),
//     Buffer.from('nft-create-uri13'),
//   ])
// );
//
// const signatureHex = signature.toString('hex');
//
// console.log('signature ', signatureHex);
//
// console.log(
//   'verifying signature',
//   publicKey.verify(
//     Buffer.concat([
//       Buffer.from('6d795f616464726573735F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F', 'hex'),
//       Buffer.from('nft-create-uri13'),
//     ]),
//     Buffer.from(signatureHex, 'hex')
//   )
// );