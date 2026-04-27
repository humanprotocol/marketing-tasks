import { ChainId } from '@human-protocol/sdk';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Wallet, ethers } from 'ethers';

import logger from '../../logger';
import { ErrorWeb3 } from '../../common/constant/errors';
import { Web3ConfigService } from '../../common/config/web3-config.service';
import { NetworkConfigService } from '../../common/config/network-config.service';

@Injectable()
export class Web3Service {
  private readonly logger = logger.child({ context: Web3Service.name });

  private signers: { [key: number]: Wallet } = {};
  readonly signerAddress: string;

  constructor(
    private readonly web3ConfigService: Web3ConfigService,
    readonly networkConfigService: NetworkConfigService,
  ) {
    const privateKey = this.web3ConfigService.privateKey;
    const validNetworks = this.networkConfigService.networks;

    for (const network of validNetworks) {
      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      this.signers[network.chainId] = new Wallet(privateKey, provider);
    }
    this.signerAddress = this.signers[validNetworks[0].chainId].address;
  }

  public getSigner(chainId: number): Wallet {
    this.validateChainId(chainId);
    return this.signers[chainId];
  }

  public validateChainId(chainId: number): void {
    const validChainIds = this.getValidChains();
    if (!validChainIds.includes(chainId)) {
      this.logger.error(ErrorWeb3.InvalidChainId, { chainId });
      throw new BadRequestException(ErrorWeb3.InvalidChainId);
    }
  }

  public getValidChains(): ChainId[] {
    return this.networkConfigService.networks.map(
      (network) => network.chainId as ChainId,
    );
  }
}
