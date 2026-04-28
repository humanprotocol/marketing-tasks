import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GrokConfigService {
  constructor(private readonly configService: ConfigService) {}

  get apiKey(): string {
    return this.configService.getOrThrow<string>('GROK_API_KEY');
  }

  get baseUrl(): string {
    return this.configService.get<string>(
      'GROK_BASE_URL',
      'https://api.x.ai/v1',
    );
  }

  get model(): string {
    return this.configService.get<string>(
      'GROK_MODEL',
      'grok-4-1-fast-reasoning',
    );
  }
}
