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
  details?: Record<string, any>;
  traceId?: string | null;
}

export interface LogEntry {
  message: string;
  context: LogContext | Record<string, any>;
  level: string;
  tags: string[];
  timestamp: string;
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

const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'cookie',
  'set-cookie',
  'token',
];

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  for (const key of SENSITIVE_HEADERS) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      hostname?: string;
      method?: string;
      originalUrl?: string;
      url?: string;
      body?: any;
      headers?: Record<string, any>;
    }>();
    const headers = request.headers ?? {};
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
      details: { body: request.body },
      traceId,
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
      message: 'Entry',
      context: logContext,
      level: 'info',
      tags: ['ENTRY'],
      timestamp: new Date().toISOString(),
    };
    this.logger.log(JSON.stringify(entry));
    return next.handle().pipe(
      tap(() => {
        clearTimeout(timeoutId);
        const ms = Date.now() - now;
        if (timedOut) {
          const entry: LogEntry = {
            message: 'Exit after timeout',
            context: logContext,
            level: 'warn',
            tags: ['TIMEDOUT'],
            timestamp: new Date().toISOString(),
          };
          this.logger.warn(JSON.stringify(entry));
        } else {
          const entry: LogEntry = {
            message: 'Exit',
            context: logContext,
            level: 'info',
            tags: ['SUCCESS'],
            timestamp: new Date().toISOString(),
          };
          this.logger.log(JSON.stringify(entry));
        }
      }),
      catchError((err) => {
        clearTimeout(timeoutId);
        const ms = Date.now() - now;
        const entry: LogEntry = {
          message: 'Error',
          context: logContext,
          level: 'error',
          tags: ['FAILED'],
          timestamp: new Date().toISOString(),
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
