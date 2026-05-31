import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError, EntityNotFoundError, TypeORMError } from 'typeorm';

/**
 * Global catch-all exception filter that handles all error types including
 * TypeORM errors, ensuring no unhandled exceptions leak to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string | string[]) ?? exception.message;
        error = (resp['error'] as string) ?? HttpStatus[status];
      } else {
        message = exceptionResponse as string;
        error = HttpStatus[status];
      }
    } else if (exception instanceof QueryFailedError) {
      // Handle TypeORM query errors
      const dbError = exception as QueryFailedError & { code?: string; detail?: string };
      if (dbError.code === '23505') {
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        message = this.extractUniqueConstraintMessage(dbError.detail ?? '');
        error = 'Conflict';
      } else if (dbError.code === '23503') {
        // Foreign key violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Referenced resource does not exist';
        error = 'Bad Request';
      } else if (dbError.code === '23502') {
        // Not null violation
        status = HttpStatus.BAD_REQUEST;
        message = 'Required field is missing';
        error = 'Bad Request';
      } else {
        this.logger.error(`Database query error: ${exception.message}`, exception.stack);
      }
    } else if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Resource not found';
      error = 'Not Found';
    } else if (exception instanceof TypeORMError) {
      this.logger.error(`TypeORM error: ${exception.message}`, exception.stack);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unknown exception type', JSON.stringify(exception));
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'],
    });
  }

  private extractUniqueConstraintMessage(detail: string): string {
    // PostgreSQL detail format: Key (column)=(value) already exists.
    const match = /Key \((.+?)\)=\((.+?)\) already exists/.exec(detail);
    if (match) {
      return `A record with this ${match[1]} already exists`;
    }
    return 'A record with this value already exists';
  }
}
