import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class XApiConfigService {
  constructor(private readonly configService: ConfigService) {}

  get consumerKey(): string {
    return this.configService.getOrThrow<string>('X_CONSUMER_KEY');
  }

  get consumerSecret(): string {
    return this.configService.getOrThrow<string>('X_CONSUMER_SECRET');
  }

  get accessToken(): string {
    return this.configService.getOrThrow<string>('X_ACCESS_TOKEN');
  }

  get accessTokenSecret(): string {
    return this.configService.getOrThrow<string>('X_ACCESS_TOKEN_SECRET');
  }

  get baseUrl(): string {
    return this.configService.get<string>(
      'X_API_BASE_URL',
      'https://api.x.com/2',
    );
  }

  get pageSize(): number {
    return Math.min(
      this.configService.get<number>('X_API_PAGE_SIZE', 100),
      100,
    );
  }

  get maxPagesPerAction(): number {
    return this.configService.get<number>('X_API_MAX_PAGES_PER_ACTION', 10);
  }
}
