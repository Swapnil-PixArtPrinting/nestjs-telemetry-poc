import { Controller, Get, Post, Body } from '@nestjs/common';
import { Idempotent } from '../common/idempotency.decorator';
import { SampleService } from './sample.service';
import { ApiResponse, buildApiResponse } from '../common/api-response.util';

@Controller('sample')
export class SampleController {
  constructor(private readonly sampleService: SampleService) {}

  @Get('ping')
  ping(): ApiResponse<{ message: string }> {
    return buildApiResponse('SUCCESS', { message: 'pong' });
  }

  @Post('echo')
  @Idempotent()
  echo(@Body() body: unknown): ApiResponse<{ echo: unknown }> {
    return buildApiResponse('SUCCESS', { echo: body });
  }

  @Post('fail')
  @Idempotent()
  fail(): ApiResponse<{ error: string }> {
    return buildApiResponse(
      'FAILED',
      { error: 'Intentional failure for testing' },
      'Request failed',
    );
  }

  @Post('timeout')
  @Idempotent()
  async timeout(): Promise<ApiResponse<{ result: string }>> {
    return this.sampleService.simulateThirdPartyCall();
  }
}
