import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logging interceptor that logs all incoming requests and outgoing responses
 * with timing information and request tracking IDs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { user?: { id?: string } }>();
    const response = ctx.getResponse<Response>();

    // Assign a unique request ID for tracing
    const requestId = (request.headers['x-request-id'] as string) ?? uuidv4();
    response.setHeader('X-Request-ID', requestId);
    response.setHeader('X-Response-Time', new Date().toISOString());

    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] ?? '';
    const userId = request.user?.id ?? 'anonymous';
    const startTime = Date.now();

    this.logger.log(
      `[${requestId}] --> ${method} ${url} | User: ${userId} | IP: ${ip} | UA: ${userAgent}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          this.logger.log(
            `[${requestId}] <-- ${method} ${url} | ${statusCode} | ${duration}ms`,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] <-- ${method} ${url} | ERROR | ${duration}ms | ${error.message}`,
          );
        },
      }),
    );
  }
}
