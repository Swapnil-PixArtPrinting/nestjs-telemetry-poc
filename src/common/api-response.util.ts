export interface ApiResponse<T = any> {
  status: 'SUCCESS' | 'FAILED' | 'TIMEDOUT';
  data?: T;
  message?: string;
  timestamp: string;
}

export function buildApiResponse<T>(
  status: 'SUCCESS' | 'FAILED' | 'TIMEDOUT',
  data?: T,
  message?: string,
): ApiResponse<T> {
  return {
    status,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}
