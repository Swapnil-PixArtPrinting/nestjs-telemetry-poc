import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const TRACING_HEADER = 'x-tracing-id';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TracingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const tracingId =
      (request.headers && request.headers[TRACING_HEADER]) || '';
    (request as any).tracingId = tracingId;
    this.logger.log(`Tracing ID came from Nginx: ${tracingId}`);
    return next.handle().pipe(
      tap(() => {
        // Optionally, add tracingId to response headers or logs
      }),
    );
  }
}
