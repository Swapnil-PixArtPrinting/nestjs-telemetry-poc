export interface ApiResponse<T = any> {
  status: 'SUCCESS' | 'FAILED' | 'TIMEDOUT';
  data?: T;
  message?: string;
  timestamp: string;
}
import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { Idempotent } from '../common/idempotency.decorator';

@Controller('sample')
export class SampleController {
  @Get('ping')
  ping(): ApiResponse<{ message: string }> {
    return {
      status: 'SUCCESS',
      data: { message: 'pong' },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('echo')
  @Idempotent()
  echo(@Body() body: unknown): ApiResponse<{ echo: unknown }> {
    return {
      status: 'SUCCESS',
      data: { echo: body },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('fail')
  @Idempotent()
  fail(): ApiResponse<{ error: string }> {
    return {
      status: 'FAILED',
      data: { error: 'Intentional failure for testing' },
      message: 'Request failed',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('timeout')
  @Idempotent()
  async timeout(
    @Headers('x-idempotency-key') idempotencyKey: string,
    @Headers('x-idempotency-status') idempotencyStatus: string,
  ): Promise<ApiResponse<{ error: string }>> {
    // If served from cache, treat as SUCCESS
    if (idempotencyStatus === 'FromCache') {
      return {
        status: 'SUCCESS',
        data: { error: 'Request timed out' },
        message: 'Served from idempotency cache',
        timestamp: new Date().toISOString(),
      };
    }
    // Simulate a long operation
    await new Promise((resolve) => setTimeout(resolve, 6000));
    // First request: return TIMEDOUT
    return {
      status: 'TIMEDOUT',
      data: { error: 'Request timed out' },
      message: 'Request timed out',
      timestamp: new Date().toISOString(),
    };
  }
}
