import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IDEMPOTENCY_KEY } from './idempotency.decorator';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as crypto from 'crypto';

const IDEMPOTENCY_HEADER = 'x-idempotency-key';
const IDEMPOTENCY_STATUS_HEADER = 'x-idempotency-status';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  generateKey(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = (request as any).ip || '';
    const url = (request as any).originalUrl || (request as any).url || '';
    const body = JSON.stringify((request as any).body || {});
    const headers = (request as any).headers || {};
    const relevantHeaders = [
      headers['authorization'] || '',
      headers['x-workspace'] || '',
      headers['x-channel'] || '',
      headers['x-tracing-id'] || '',
    ];
    const hash = crypto
      .createHash('sha256')
      .update(ip + url + body + relevantHeaders.join(''))
      .digest('hex');
    return hash;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENCY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isIdempotent) {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();
    let idempotencyKey = (request.headers &&
      request.headers[IDEMPOTENCY_HEADER]) as string | undefined;
    if (!idempotencyKey) {
      idempotencyKey = this.generateKey(context);
      if (request.headers) request.headers[IDEMPOTENCY_HEADER] = idempotencyKey;
    }
    const cacheKey = `idempotency:${idempotencyKey}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      response.setHeader(IDEMPOTENCY_HEADER, idempotencyKey);
      response.setHeader(IDEMPOTENCY_STATUS_HEADER, 'FromCache');
      return of(cached);
    }
    return next.handle().pipe(
      tap((data) => {
        response.setHeader(IDEMPOTENCY_HEADER, idempotencyKey);
        response.setHeader(IDEMPOTENCY_STATUS_HEADER, 'Original');
        // Fire-and-forget cache set, do not await
        void this.cacheManager.set(cacheKey, data, 60 * 60);
      }),
    );
  }
}
