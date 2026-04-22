/* eslint-disable no-console */
import { KVStoreClient, KVStoreKeys, Role } from '@human-protocol/sdk';
import * as dotenv from 'dotenv';
import { NonceManager, Wallet, ethers } from 'ethers';
import * as Minio from 'minio';

const isLocalEnv = process.env.LOCAL === 'true';
const envFilePath = isLocalEnv ? '.env.local' : '.env';
const supportedJobTypes = 'social_media_promotion';

dotenv.config({ path: envFilePath });

const rpcUrl = isLocalEnv
  ? process.env.RPC_URL_LOCALHOST
  : process.env.RPC_URL_POLYGON_AMOY;

async function setupCommonValues(kvStoreClient: KVStoreClient): Promise<void> {
  const { SERVER_URL, HOST, PORT, FEE = '1' } = process.env;
  const serverUrl = SERVER_URL || `http://${HOST}:${PORT}`;

  try {
    new URL(serverUrl);
  } catch {
    throw new Error('Invalid SERVER_URL');
  }

  let url = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  if (!url.startsWith('http')) {
    url = `http://${url}`;
  }

  const fee = Number(FEE);
  if (!Number.isInteger(fee) || fee < 1) {
    throw new Error('FEE must be a positive integer');
  }

  await kvStoreClient.setBulk(
    [
      KVStoreKeys.role,
      KVStoreKeys.fee,
      KVStoreKeys.url,
      KVStoreKeys.webhookUrl,
      KVStoreKeys.jobTypes,
    ],
    [
      Role.ExchangeOracle,
      fee.toString(),
      url,
      `${url}/webhook`,
      supportedJobTypes,
    ],
  );
}

async function setupPublicKeyFile(
  kvStoreClient: KVStoreClient,
  minioClient: Minio.Client,
): Promise<void> {
  const {
    S3_BUCKET,
    S3_ENDPOINT,
    S3_PORT,
    PGP_PUBLIC_KEY,
    PGP_PUBLIC_KEY_FILE = 'pgp-public-key-exchange',
  } = process.env;

  if (!S3_BUCKET || !S3_ENDPOINT || !S3_PORT || !PGP_PUBLIC_KEY) {
    throw new Error('Missing S3 or PGP public key configuration');
  }

  const exists = await minioClient.bucketExists(S3_BUCKET);
  if (!exists) {
    throw new Error(`Bucket does not exist: ${S3_BUCKET}`);
  }

  await minioClient.putObject(
    S3_BUCKET,
    PGP_PUBLIC_KEY_FILE,
    PGP_PUBLIC_KEY,
    undefined,
    {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store',
    },
  );

  const endpoint = S3_ENDPOINT.startsWith('http')
    ? S3_ENDPOINT
    : `http://${S3_ENDPOINT}`;
  const fileUrl = `${endpoint}:${S3_PORT}/${S3_BUCKET}/${PGP_PUBLIC_KEY_FILE}`;

  await kvStoreClient.setFileUrlAndHash(fileUrl, KVStoreKeys.publicKey);
}

async function setup(): Promise<void> {
  if (!rpcUrl) {
    throw new Error('RPC url is empty');
  }

  const {
    WEB3_PRIVATE_KEY,
    S3_ENDPOINT,
    S3_PORT,
    S3_USE_SSL,
    S3_ACCESS_KEY,
    S3_SECRET_KEY,
    PGP_ENCRYPT,
  } = process.env;

  if (!WEB3_PRIVATE_KEY || WEB3_PRIVATE_KEY === 'replace_me') {
    throw new Error('WEB3_PRIVATE_KEY must be configured');
  }

  if (
    [S3_ENDPOINT, S3_PORT, S3_ACCESS_KEY, S3_SECRET_KEY].some(
      (value) => !value,
    )
  ) {
    throw new Error('Missing S3 config value');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const baseWallet = new Wallet(WEB3_PRIVATE_KEY, provider);
  const wallet = new NonceManager(baseWallet);
  const kvStoreClient = await KVStoreClient.build(wallet);

  await setupCommonValues(kvStoreClient);

  if (PGP_ENCRYPT === 'true') {
    const minioClient = new Minio.Client({
      endPoint: S3_ENDPOINT as string,
      port: parseInt(S3_PORT as string, 10),
      useSSL: S3_USE_SSL === 'true',
      accessKey: S3_ACCESS_KEY as string,
      secretKey: S3_SECRET_KEY as string,
    });

    await setupPublicKeyFile(kvStoreClient, minioClient);
  }
}

(async () => {
  try {
    await setup();
    process.exit(0);
  } catch (error) {
    console.error('Failed to setup KV.', error);
    process.exit(1);
  }
})();
