import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { FranchiseesService, PaginationQuery } from './franchisees.service';
import { CreateFranchiseeDto } from './dto/create-franchisee.dto';
import { PaymentType } from './franchisee-payment.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class RecordPaymentDto {
  @ApiProperty({ example: 25000, description: 'Payment amount in INR' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: PaymentType })
  @IsEnum(PaymentType)
  type: PaymentType;

  @ApiPropertyOptional({ example: 'Monthly commission for January 2024' })
  @IsOptional()
  @IsString()
  notes?: string;
}

class ProcessCommissionDto {
  @ApiProperty({ example: '2024-01-01' })
  @IsString()
  periodStart: string;

  @ApiProperty({ example: '2024-01-31' })
  @IsString()
  periodEnd: string;
}

class SuspendFranchiseeDto {
  @ApiPropertyOptional({ example: 'Non-compliance with standards' })
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Franchisees')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('franchisees')
export class FranchiseesController {
  constructor(private readonly franchiseesService: FranchiseesService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Onboard a new franchisee with contract details' })
  @ApiResponse({ status: 201, description: 'Franchisee onboarded successfully' })
  @ApiResponse({ status: 409, description: 'Franchisee with this email already exists' })
  async onboard(@Body() dto: CreateFranchiseeDto) {
    return this.franchiseesService.onboard(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all franchisees with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'active', 'suspended', 'terminated'] })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.franchiseesService.findAll({ page, limit, search, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get franchisee by ID with financials' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.franchiseesService.findById(id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update franchisee details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateFranchiseeDto>,
  ) {
    return this.franchiseesService.update(id, dto);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get franchise dashboard with station status and financials' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getDashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.franchiseesService.getDashboard(id);
  }

  @Get(':id/revenue')
  @ApiOperation({ summary: 'Get detailed revenue/commission breakdown' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'period', required: false, enum: ['month', 'quarter', 'year'], description: 'Aggregation period' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  @ApiQuery({ name: 'month', required: false, type: Number })
  async getRevenue(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period: 'month' | 'quarter' | 'year' = 'month',
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.franchiseesService.getRevenueSplit(
      id,
      period,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Post(':id/commission')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Process commission payment for a period' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async processCommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessCommissionDto,
  ) {
    return this.franchiseesService.processCommission(
      id,
      dto.periodStart,
      dto.periodEnd,
    );
  }

  @Get(':id/station-health')
  @ApiOperation({ summary: 'Get health status of all franchisee stations' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getStationHealth(@Param('id', ParseUUIDPipe) id: string) {
    return this.franchiseesService.getStationHealth(id);
  }

  @Post(':id/payments')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Record a franchise fee or commission payment' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.franchiseesService.recordPayment(id, dto.amount, dto.type, dto.notes);
  }

  @Patch(':id/activate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a franchisee' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.franchiseesService.activate(id);
  }

  @Patch(':id/suspend')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a franchisee' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendFranchiseeDto,
  ) {
    return this.franchiseesService.suspend(id, dto.reason);
  }
}
