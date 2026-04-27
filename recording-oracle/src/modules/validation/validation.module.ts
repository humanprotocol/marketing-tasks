import { Module } from '@nestjs/common';

import { GrokService } from './grok/grok.service';
import { ValidationService } from './validation.service';

@Module({
  providers: [
    GrokService,
    {
      provide: ValidationService,
      useExisting: GrokService,
    },
  ],
  exports: [ValidationService],
})
export class ValidationModule {}
