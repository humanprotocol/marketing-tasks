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
  POSTGRES_HOST: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  POSTGRES_PORT: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.number().optional(),
    otherwise: Joi.number().required(),
  }),
  POSTGRES_USER: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  POSTGRES_PASSWORD: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  POSTGRES_DATABASE: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  POSTGRES_SSL: Joi.string(),
  POSTGRES_LOGGING: Joi.string(),
  // S3
  S3_ENDPOINT: Joi.string().required(),
  S3_PORT: Joi.string().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),
  S3_USE_SSL: Joi.string().required(),
  // Encryption
  PGP_ENCRYPT: Joi.boolean().required(),
  PGP_PRIVATE_KEY: Joi.when('PGP_ENCRYPT', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  PGP_PASSPHRASE: Joi.when('PGP_ENCRYPT', {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().optional(),
  }),
  // Grok
  GROK_API_KEY: Joi.string().optional(),
  GROK_BASE_URL: Joi.string().uri(),
  GROK_MODEL: Joi.string().optional(),
  // X API
  X_CONSUMER_KEY: Joi.string().optional(),
  X_CONSUMER_SECRET: Joi.string().optional(),
  X_ACCESS_TOKEN: Joi.string().optional(),
  X_ACCESS_TOKEN_SECRET: Joi.string().optional(),
  X_API_BASE_URL: Joi.string().uri(),
  X_API_PAGE_SIZE: Joi.number(),
  X_API_MAX_PAGES_PER_ACTION: Joi.number(),
});
