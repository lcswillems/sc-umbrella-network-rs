import { UserSecretKey } from '@multiversx/sdk-wallet';
import * as fs from 'fs';
import createKeccakHash from "keccak";
import { Address } from "@multiversx/sdk-core"
import BigNumber from "bignumber.js";
import { BigUIntValue, BinaryCodec } from "@multiversx/sdk-core"
import EC from 'elliptic';



const file = fs.readFileSync('./test-signer.pem').toString();
const privateKey = UserSecretKey.fromPem(file);

const priceKey = createKeccakHash('keccak256').update('ETH-USD').digest('hex');

console.log('ETH-USD price key hex', priceKey);

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

// get_price_data_hash
let data = Buffer.concat([
  contractAddress,

  // price_keys
  Buffer.from(priceKey, 'hex'),

  // price_datas
  Buffer.from(priceData.data.toString()),
  Buffer.from(priceData.hearbeat.toString()),
  Buffer.from(priceData.timestamp.toString()),
  codec.encodeNested(new BigUIntValue(priceData.price)),
]);

console.log('data to be signed', data);

const dataHash = createKeccakHash('keccak256').update(data).digest();

console.log('data hash to be signed', dataHash);

// verify_signature
const newData = Buffer.concat([
  Buffer.from("\x19MultiversX Signed Message:\\n32"),
  Buffer.from(dataHash)
]);

console.log('new data', newData);

const newDataHash = createKeccakHash('keccak256').update(newData).digest();

console.log('new data hash', newDataHash);

// secp256k1 signature
const secp256k1 = EC.ec('secp256k1');

const key = secp256k1.keyFromPrivate(privateKey.valueOf());

const sigObj = key.sign(newDataHash);

console.log('signature', sigObj);
console.log('signature r', sigObj.r.toString('hex'));
console.log('signature s', sigObj.s.toString('hex'));

const newPublicKey = key.getPublic();

console.log('new public key', newPublicKey.encodeCompressed('hex'));

const verifySignature = secp256k1.verify(newDataHash, sigObj, newPublicKey);

console.log('verify signature', verifySignature);
