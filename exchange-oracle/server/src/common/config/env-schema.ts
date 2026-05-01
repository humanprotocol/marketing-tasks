import * as Joi from 'joi';

export const envValidator = Joi.object({
  // General
  HOST: Joi.string(),
  PORT: Joi.string(),
  FE_URL: Joi.string(),
  MAX_RETRY_COUNT: Joi.number(),
  // Database
  POSTGRES_URL: Joi.string().optional(),
  POSTGRES_HOST: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
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
  POSTGRES_PORT: Joi.when('POSTGRES_URL', {
    is: Joi.exist(),
    then: Joi.string().optional(),
    otherwise: Joi.string().required(),
  }),
  POSTGRES_SSL: Joi.string(),
  POSTGRES_LOGGING: Joi.string(),
  // Web3
  WEB3_ENV: Joi.string(),
  WEB3_PRIVATE_KEY: Joi.string().required(),
  RPC_URL_POLYGON: Joi.string(),
  RPC_URL_BSC: Joi.string(),
  RPC_URL_POLYGON_AMOY: Joi.string(),
  RPC_URL_SEPOLIA: Joi.string(),
  RPC_URL_BSC_TESTNET: Joi.string(),
  RPC_URL_LOCALHOST: Joi.string(),
  // PGP
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
});
