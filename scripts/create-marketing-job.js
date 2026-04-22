/* eslint-disable no-console */
const { createHash } = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const {
  ChainId,
  EscrowClient,
  NETWORKS,
  StakingClient,
} = require('@human-protocol/sdk');
const { Contract, NonceManager, Wallet, ethers } = require('ethers');
const Minio = require('minio');

const EXCHANGE_ORACLE_ADDRESS = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
const RECORDING_ORACLE_ADDRESS = '0x976EA74026E726554dB657fA54763abd0C3a0aa9';
const REPUTATION_ORACLE_ADDRESS = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const LOCAL_RPC_URL = 'http://127.0.0.1:8545';
const EXCHANGE_WEBHOOK_URL = 'http://127.0.0.1:5006/webhook';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCAL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const LOCAL_MINIO_CONFIG = {
  endPoint: '127.0.0.1',
  port: 9000,
  useSSL: false,
  accessKey: 'human-oracle',
  secretKey: 'human-oracle-s3-secret',
  bucket: 'fortune',
};

const ERC20_ABI = [
  'function approve(address spender, uint256 value) returns (bool)',
  'function decimals() view returns (uint8)',
];
const HEADER_SIGNATURE_KEY = 'human-signature';

function parseArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      throw new Error(`Unknown argument: ${current}`);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for argument: ${current}`);
    }

    values[current.slice(2)] = next;
    index += 1;
  }

  if (!values.manifest) {
    throw new Error(
      'Missing required argument: --manifest /path/to/manifest.json',
    );
  }

  if (!values['fund-amount']) {
    throw new Error('Missing required argument: --fund-amount 100');
  }

  return {
    manifestPath: values.manifest,
    fundAmount: values['fund-amount'],
    requesterId: `marketing-local-${Date.now()}`,
    objectKey: values['object-key'],
    bucket: values.bucket,
  };
}

function getManifestHash(content) {
  return createHash('sha1').update(content).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function resolveManifestPath(manifestPathArg) {
  if (path.isAbsolute(manifestPathArg)) {
    return manifestPathArg;
  }

  const repoRootCandidate = path.resolve(PROJECT_ROOT, manifestPathArg);
  try {
    await fs.access(repoRootCandidate);
    return repoRootCandidate;
  } catch {
    return path.resolve(process.cwd(), manifestPathArg);
  }
}

function buildObjectUrl(endPoint, port, useSSL, bucket, objectKey) {
  const protocol = useSSL ? 'https' : 'http';
  const encodedObjectKey = objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${protocol}://${endPoint}:${port}/${bucket}/${encodedObjectKey}`;
}

async function uploadManifest(minioClient, manifestContent, options) {
  const s3Bucket = options.bucket || LOCAL_MINIO_CONFIG.bucket;
  const manifestHash = getManifestHash(manifestContent);
  const manifestBasename = path.basename(options.manifestPath);
  const objectKey =
    options.objectKey ||
    `marketing/manifests/${Date.now()}-${manifestBasename}`;

  const bucketExists = await minioClient.bucketExists(s3Bucket);
  if (!bucketExists) {
    await minioClient.makeBucket(s3Bucket);
  }

  await minioClient.putObject(
    s3Bucket,
    objectKey,
    manifestContent,
    Buffer.byteLength(manifestContent),
    {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  );

  return {
    bucket: s3Bucket,
    objectKey,
    manifestHash,
    manifestUrl: buildObjectUrl(
      LOCAL_MINIO_CONFIG.endPoint,
      LOCAL_MINIO_CONFIG.port,
      LOCAL_MINIO_CONFIG.useSSL,
      s3Bucket,
      objectKey,
    ),
  };
}

async function signMessage(message, privateKey) {
  const wallet = new Wallet(privateKey);
  const payload = typeof message === 'string' ? message : JSON.stringify(message);

  return wallet.signMessage(payload);
}

async function setupStake(wallet, hmtAddress, stakingAddress) {
  const tokenContract = new Contract(hmtAddress, ERC20_ABI, wallet);
  const approveStakeTx = await tokenContract.approve(stakingAddress, 1n);
  await approveStakeTx.wait();

  const stakingClient = await StakingClient.build(wallet);
  await stakingClient.stake(1n);
}

async function notifyExchangeOracle(escrowAddress) {
  const webhookBody = {
    chain_id: ChainId.LOCALHOST,
    escrow_address: escrowAddress,
    event_type: 'escrow_created',
  };
  const signature = await signMessage(webhookBody, LOCAL_PRIVATE_KEY);

  const response = await fetch(EXCHANGE_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [HEADER_SIGNATURE_KEY]: signature,
    },
    body: JSON.stringify(webhookBody),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Exchange webhook failed with status ${response.status}: ${responseBody}`,
    );
  }
}

async function createMarketingJob(options) {
  const manifestPath = await resolveManifestPath(options.manifestPath);
  const manifestContent = await fs.readFile(manifestPath, 'utf8');
  JSON.parse(manifestContent);

  const minioClient = new Minio.Client(LOCAL_MINIO_CONFIG);

  const { manifestHash, manifestUrl, bucket, objectKey } = await uploadManifest(
    minioClient,
    manifestContent,
    options,
  );

  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  const baseWallet = new Wallet(LOCAL_PRIVATE_KEY, provider);
  const wallet = new NonceManager(baseWallet);
  const { hmtAddress, factoryAddress, stakingAddress } = NETWORKS[
    ChainId.LOCALHOST
  ];

  await setupStake(wallet, hmtAddress, stakingAddress);

  const tokenContract = new Contract(hmtAddress, ERC20_ABI, wallet);
  const tokenDecimals = Number(await tokenContract.decimals());
  const amountInWei = ethers.parseUnits(options.fundAmount, tokenDecimals);

  if (amountInWei <= 0n) {
    throw new Error('The fund amount must be greater than zero');
  }

  const approveTx = await tokenContract.approve(factoryAddress, amountInWei);
  await approveTx.wait();

  const escrowClient = await EscrowClient.build(wallet);
  const escrowAddress = await escrowClient.createFundAndSetupEscrow(
    hmtAddress,
    amountInWei,
    options.requesterId,
    {
      exchangeOracle: EXCHANGE_ORACLE_ADDRESS,
      recordingOracle: RECORDING_ORACLE_ADDRESS,
      reputationOracle: REPUTATION_ORACLE_ADDRESS,
      manifest: manifestUrl,
      manifestHash,
    },
  );

  await sleep(2000);
  await notifyExchangeOracle(escrowAddress);

  console.log(
    JSON.stringify(
      {
        escrowAddress,
        manifestPath,
        manifestUrl,
        manifestHash,
        bucket,
        objectKey,
        requesterId: options.requesterId,
        fundAmount: options.fundAmount,
        amountInWei: amountInWei.toString(),
        tokenAddress: hmtAddress,
        factoryAddress,
        stakingAddress,
        rpcUrl: LOCAL_RPC_URL,
        exchangeWebhookUrl: EXCHANGE_WEBHOOK_URL,
        minio: {
          endPoint: LOCAL_MINIO_CONFIG.endPoint,
          port: LOCAL_MINIO_CONFIG.port,
          useSSL: LOCAL_MINIO_CONFIG.useSSL,
          bucket,
        },
        exchangeOracle: EXCHANGE_ORACLE_ADDRESS,
        recordingOracle: RECORDING_ORACLE_ADDRESS,
        reputationOracle: REPUTATION_ORACLE_ADDRESS,
      },
      null,
      2,
    ),
  );
}

(async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    await createMarketingJob(options);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create the marketing escrow.', error);
    process.exit(1);
  }
})();
