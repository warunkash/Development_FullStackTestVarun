import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * Global HTTP exception filter that formats errors consistently.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string | string[];
    let error: string;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp['message'] as string | string[]) ?? exception.message;
      error = (resp['error'] as string) ?? HttpStatus[status];
    } else {
      message = exceptionResponse as string;
      error = HttpStatus[status];
    }

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'] as string | undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} Error: ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`HTTP ${status}: ${request.method} ${request.url} - ${JSON.stringify(message)}`);
    }

    response.status(status).json(errorResponse);
  }
}
