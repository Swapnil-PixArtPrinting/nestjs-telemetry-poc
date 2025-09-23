import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Idempotent } from './common/idempotency.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Idempotent()
  getHello(): { status: string; data: any } {
    return {
      status: 'SUCCESS',
      data: this.appService.getHello(),
    };
  }
}
