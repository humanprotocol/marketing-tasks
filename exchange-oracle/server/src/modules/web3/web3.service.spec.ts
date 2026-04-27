import { ChainId } from '@human-protocol/sdk';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ErrorWeb3 } from '../../common/constant/errors';
import { Web3Service } from './web3.service';
import { MOCK_PRIVATE_KEY, mockConfig } from './../../../test/constants';
import { Web3ConfigService } from '../../common/config/web3-config.service';
import { NetworkConfigService } from '../../common/config/network-config.service';

describe('Web3Service', () => {
  let web3Service: Web3Service;
  let networkConfigService: NetworkConfigService;

  jest
    .spyOn(Web3ConfigService.prototype, 'privateKey', 'get')
    .mockReturnValue(MOCK_PRIVATE_KEY);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
            getOrThrow: jest.fn((key: string) => {
              if (!mockConfig[key]) {
                throw new Error(`Configuration key "${key}" does not exist`);
              }
              return mockConfig[key];
            }),
          },
        },
        Web3Service,
        Web3ConfigService,
        NetworkConfigService,
      ],
    }).compile();

    web3Service = moduleRef.get<Web3Service>(Web3Service);
    networkConfigService =
      moduleRef.get<NetworkConfigService>(NetworkConfigService);
  });

  describe('getSigner', () => {
    it('should return a signer for a configured chainId', () => {
      const validChainId = ChainId.POLYGON_AMOY;

      const signer = web3Service.getSigner(validChainId);
      expect(signer).toBeDefined();
    });

    it('should throw invalid chain id provided for configured networks', () => {
      const invalidChainId = ChainId.POLYGON;

      expect(() => web3Service.getSigner(invalidChainId)).toThrow(
        ErrorWeb3.InvalidChainId,
      );
    });
  });

  describe('getValidChains', () => {
    it('should get chainIds from configured networks', () => {
      const validChainIds = web3Service.getValidChains();
      expect(validChainIds).toEqual([ChainId.POLYGON_AMOY]);
    });

    it('should reflect network config changes', () => {
      jest
        .spyOn(networkConfigService, 'networks', 'get')
        .mockReturnValue([
          {
            chainId: ChainId.POLYGON,
            rpcUrl: 'http://polygon-rpc.url',
          },
          {
            chainId: ChainId.BSC_MAINNET,
            rpcUrl: 'http://bsc-rpc.url',
          },
        ]);

      const validChainIds = web3Service.getValidChains();
      expect(validChainIds).toEqual([ChainId.POLYGON, ChainId.BSC_MAINNET]);
    });
  });
});
