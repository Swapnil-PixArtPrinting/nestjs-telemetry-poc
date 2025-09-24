const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
  'token',
  // Add more keys here as needed
];

function sanitizeObject(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key in sanitized) {
    if (keys.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key], keys);
    }
  }
  return sanitized;
}
export interface LogContext {
  remote_addr: string | null;
  hostname: string | null;
  method: string | null;
  url: string | null;
  referrer: string | null;
  user_agent: string | null;
  workspace: string;
  workspaceEnv: string;
  store: string | null;
  channel: string | null;
  jwtEmail: string | null;
  processingTimeMs: number;
  cacheStatus: string;
  details?: unknown;
  traceId?: string | null;
}

export interface LogEntry {
  message: string;
  context: LogContext | Record<string, any>;
  level: string;
  tags: string[];
  timestamp: string;
  processingTimeMs?: number;
  cacheStatus?: string;
  trace?: Record<string, any>;
}
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<{ [key: string]: any }>();
    const response = context
      .switchToHttp()
      .getResponse<{ getHeader?: (name: string) => string }>();
    let headers: Record<string, any> = request.headers ?? {};
    headers = sanitizeObject(headers, SENSITIVE_HEADERS);
    // Read idempotency status from response headers if available, else from request headers
    let idempotencyStatus: string | undefined = undefined;
    if (typeof response.getHeader === 'function') {
      const val = response.getHeader('x-idempotency-status');
      if (typeof val === 'string') idempotencyStatus = val;
    }
    if (
      !idempotencyStatus &&
      typeof headers['x-idempotency-status'] === 'string'
    ) {
      idempotencyStatus = headers['x-idempotency-status'];
    }
    const traceId =
      typeof headers['x-tracing-id'] === 'string'
        ? headers['x-tracing-id']
        : null;
    const logContext: LogContext = {
      remote_addr: typeof request.ip === 'string' ? request.ip : null,
      hostname: typeof request.hostname === 'string' ? request.hostname : null,
      method: typeof request.method === 'string' ? request.method : null,
      url:
        typeof request.originalUrl === 'string'
          ? request.originalUrl
          : typeof request.url === 'string'
            ? request.url
            : null,
      referrer:
        typeof headers['referer'] === 'string'
          ? headers['referer']
          : typeof headers['referrer'] === 'string'
            ? headers['referrer']
            : null,
      user_agent:
        typeof headers['user-agent'] === 'string'
          ? headers['user-agent']
          : null,
      workspace:
        typeof headers['x-workspace'] === 'string'
          ? headers['x-workspace']
          : '',
      workspaceEnv:
        typeof headers['x-workspace-env'] === 'string'
          ? headers['x-workspace-env']
          : '',
      store: typeof headers['x-store'] === 'string' ? headers['x-store'] : null,
      channel:
        typeof headers['x-channel'] === 'string' ? headers['x-channel'] : null,
      jwtEmail:
        typeof headers['x-jwt-email'] === 'string'
          ? headers['x-jwt-email']
          : null,
      details: { body: sanitizeObject(request.body, SENSITIVE_HEADERS) },
      traceId,
      processingTimeMs: 0, // will be set later
      cacheStatus: idempotencyStatus ?? 'None',
    };
    const TIMEOUT_MS = 5000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      const entry: LogEntry = {
        message: 'Timeout',
        context: logContext,
        level: 'warn',
        tags: ['TIMEDOUT'],
        timestamp: new Date().toISOString(),
      };
      this.logger.warn(JSON.stringify(entry));
    }, TIMEOUT_MS);
    const entry: LogEntry = {
      message: 'Request',
      context: sanitizeObject(logContext, SENSITIVE_HEADERS),
      level: 'info',
      tags: ['REQUEST'],
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(entry));
    return next.handle().pipe(
      tap((responseData) => {
        clearTimeout(timeoutId);
        const ms = Date.now() - now;
        logContext.processingTimeMs = ms;
        // Re-read cache status from response headers (in case it was set after entry)
        let cacheStatus: string | undefined = undefined;
        if (typeof response.getHeader === 'function') {
          const val = response.getHeader('x-idempotency-status');
          if (typeof val === 'string') cacheStatus = val;
        }
        if (
          !cacheStatus &&
          typeof headers['x-idempotency-status'] === 'string'
        ) {
          cacheStatus = headers['x-idempotency-status'];
        }
        logContext.cacheStatus = cacheStatus ?? 'None';
        let tag = 'SUCCESS';
        if (responseData && typeof responseData.status === 'string') {
          tag = responseData.status;
        } else if (timedOut) {
          tag = 'TIMEDOUT';
        }
        const entry: LogEntry = {
          message: timedOut ? 'Exit after timeout' : 'Response',
          context: sanitizeObject(logContext, SENSITIVE_HEADERS),
          level: timedOut ? 'warn' : 'info',
          tags: [tag],
          timestamp: new Date().toISOString(),
          processingTimeMs: logContext.processingTimeMs,
        };
        if (timedOut) {
          this.logger.warn(JSON.stringify(entry));
        } else {
          this.logger.log(JSON.stringify(entry));
        }
      }),
      catchError((err) => {
        clearTimeout(timeoutId);
        const ms = Date.now() - now;
        logContext.processingTimeMs = ms;
        let cacheStatus: string | undefined = undefined;
        if (typeof response.getHeader === 'function') {
          const val = response.getHeader('x-idempotency-status');
          if (typeof val === 'string') cacheStatus = val;
        }
        if (
          !cacheStatus &&
          typeof headers['x-idempotency-status'] === 'string'
        ) {
          cacheStatus = headers['x-idempotency-status'];
        }
        logContext.cacheStatus = cacheStatus ?? 'None';
        const entry: LogEntry = {
          message: 'Error',
          context: sanitizeObject(logContext, SENSITIVE_HEADERS),
          level: 'error',
          tags: ['FAILED'],
          timestamp: new Date().toISOString(),
          processingTimeMs: logContext.processingTimeMs,
          trace: {
            error: err instanceof Error ? err.message : String(err),
            traceId,
          },
        };
        this.logger.error(JSON.stringify(entry));
        throw err;
      }),
    );
  }
}
