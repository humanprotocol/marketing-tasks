import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LinkdapiConfigService {
  constructor(private readonly configService: ConfigService) {}

  get apiKey(): string | undefined {
    return this.configService.get<string>('LINKDAPI_API_KEY');
  }

  get baseUrl(): string {
    return this.configService.get<string>(
      'LINKDAPI_BASE_URL',
      'https://linkdapi.com',
    );
  }

  get pageSize(): number {
    return Math.min(
      this.configService.get<number>('LINKDAPI_PAGE_SIZE', 100),
      100,
    );
  }

  get maxPagesPerAction(): number {
    return this.configService.get<number>('LINKDAPI_MAX_PAGES_PER_ACTION', 10);
  }
}
