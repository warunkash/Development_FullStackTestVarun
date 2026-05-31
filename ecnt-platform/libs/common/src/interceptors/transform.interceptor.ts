import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
}

/**
 * Transform interceptor that wraps all successful responses in a consistent
 * envelope format: { success: true, data: ..., timestamp: ... }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = response.getHeader('X-Request-ID') as string | undefined;

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
        requestId,
      })),
    );
  }
}
