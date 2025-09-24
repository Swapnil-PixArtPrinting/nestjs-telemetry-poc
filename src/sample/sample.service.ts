import { Injectable } from '@nestjs/common';
import { ApiResponse, buildApiResponse } from '../common/api-response.util';
@Injectable()
export class SampleService {
  async simulateThirdPartyCall(): Promise<ApiResponse<{ result: string }>> {
    // Simulate a third-party API call that takes 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const result = { result: 'Third-party API response' };
    return buildApiResponse('SUCCESS', result, 'Third-party API response');
  }
}
