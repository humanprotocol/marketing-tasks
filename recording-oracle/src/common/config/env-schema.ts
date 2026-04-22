import * as Joi from 'joi';

export const envValidator = Joi.object({
  // General
  HOST: Joi.string(),
  PORT: Joi.string(),
  SOCIAL_MEDIA_VALIDATION_MAX_RETRIES: Joi.number(),
  // Web3
  WEB3_PRIVATE_KEY: Joi.string().required(),
  SDK_TX_TIMEOUT_MS: Joi.number(),
  RPC_URL_POLYGON: Joi.string(),
  RPC_URL_BSC: Joi.string(),
  RPC_URL_POLYGON_AMOY: Joi.string(),
  RPC_URL_SEPOLIA: Joi.string(),
  RPC_URL_MOONBEAM: Joi.string(),
  RPC_URL_BSC_TESTNET: Joi.string(),
  RPC_URL_LOCALHOST: Joi.string(),
  // Postgres
  POSTGRES_URL: Joi.string().optional(),
  POSTGRES_HOST: Joi.string(),
  POSTGRES_PORT: Joi.number(),
  POSTGRES_USER: Joi.string(),
  POSTGRES_PASSWORD: Joi.string(),
  POSTGRES_DATABASE: Joi.string(),
  POSTGRES_SSL: Joi.string(),
  POSTGRES_LOGGING: Joi.string(),
  // S3
  S3_ENDPOINT: Joi.string(),
  S3_PORT: Joi.string(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string(),
  S3_USE_SSL: Joi.string(),
  // Encryption
  PGP_ENCRYPT: Joi.boolean(),
  PGP_PRIVATE_KEY: Joi.string().optional(),
  PGP_PASSPHRASE: Joi.string().optional(),
  // Grok
  XAI_API_KEY: Joi.string().optional(),
  GROK_API_KEY: Joi.string().optional(),
  XAI_BASE_URL: Joi.string(),
  GROK_MODEL: Joi.string(),
});
