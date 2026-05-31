import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { FleetBillingService, CreateBillingRecordDto } from './fleet-billing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

class CreateBillingRecordBodyDto implements CreateBillingRecordDto {
  @ApiProperty() @IsString() fleetAccountId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() fleetVehicleId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() fleetDriverId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() sessionId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() stationId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() stationName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() chargerId?: string;
  @ApiProperty({ example: 25.5 }) @IsNumber() energyKwh: number;
  @ApiProperty({ example: 382.5 }) @IsNumber() amount: number;
  @ApiProperty({ required: false, example: 38.25 }) @IsOptional() @IsNumber() discountAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() sessionStart?: Date;
  @ApiProperty({ required: false }) @IsOptional() sessionEnd?: Date;
}

@ApiTags('Fleet Billing')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fleet/billing')
export class FleetBillingController {
  constructor(private readonly fleetBillingService: FleetBillingService) {}

  @Post('records')
  @Roles('admin', 'system')
  @ApiOperation({ summary: 'Create a fleet billing record (internal/system use)' })
  async createRecord(@Body() dto: CreateBillingRecordBodyDto) {
    return this.fleetBillingService.createBillingRecord(dto);
  }

  @Get('accounts/:fleetAccountId/records')
  @ApiOperation({ summary: 'Get billing records for a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBillingRecords(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.fleetBillingService.getFleetBillingRecords(
      fleetAccountId,
      Number(page),
      Number(limit),
    );
  }

  @Post('accounts/:fleetAccountId/invoice')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Generate monthly invoice for a fleet account' })
  @ApiParam({ name: 'fleetAccountId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  async generateInvoice(
    @Param('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
    @Query('year') year: number,
    @Query('month') month: number,
  ) {
    return this.fleetBillingService.generateMonthlyInvoice(
      fleetAccountId,
      Number(year),
      Number(month),
    );
  }

  @Patch('invoices/:invoiceId/pay')
  @Roles('admin', 'finance')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiParam({ name: 'invoiceId', type: 'string' })
  @ApiQuery({ name: 'fleetAccountId', required: true, type: 'string' })
  async markAsPaid(
    @Param('invoiceId') invoiceId: string,
    @Query('fleetAccountId', ParseUUIDPipe) fleetAccountId: string,
  ) {
    await this.fleetBillingService.markAsPaid(invoiceId, fleetAccountId);
    return { message: `Invoice ${invoiceId} marked as paid` };
  }
}
