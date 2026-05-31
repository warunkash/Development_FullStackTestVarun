import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResult } from '../dtos/pagination.dto';

/**
 * Decorator for Swagger documentation of paginated API responses.
 * @example @ApiPaginatedResponse(StationDto)
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(PaginatedResult, model),
    ApiOkResponse({
      description: 'Paginated list of items',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResult) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              total: { type: 'number', example: 100 },
              page: { type: 'number', example: 1 },
              limit: { type: 'number', example: 20 },
              totalPages: { type: 'number', example: 5 },
            },
          },
        ],
      },
    }),
  );
