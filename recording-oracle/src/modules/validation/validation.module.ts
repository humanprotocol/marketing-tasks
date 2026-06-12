import { Module } from '@nestjs/common';

import { GrokService } from './grok/grok.service';
import { LinkdapiService } from './linkdapi/linkdapi.service';
import { ValidationService } from './validation.service';
import { XApiService } from './x-api/x-api.service';

@Module({
  providers: [GrokService, LinkdapiService, XApiService, ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
