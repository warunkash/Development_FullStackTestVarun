import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TariffsService } from './tariffs.service';
import { CreateTariffDto } from './dto/create-tariff.dto';

@ApiTags('tariffs')
@ApiBearerAuth()
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tariff (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tariff created' })
  async create(@Body() dto: CreateTariffDto) {
    return this.tariffsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active tariffs' })
  @ApiResponse({ status: 200, description: 'List of tariffs' })
  async findAll() {
    return this.tariffsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tariff details with rules' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tariff with time-of-day rules' })
  @ApiResponse({ status: 404, description: 'Tariff not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tariffsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update tariff (Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Tariff updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTariffDto>,
  ) {
    return this.tariffsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tariff (Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Tariff deleted' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.tariffsService.delete(id);
  }
}
