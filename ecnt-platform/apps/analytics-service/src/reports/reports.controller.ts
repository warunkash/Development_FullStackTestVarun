import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as moment from 'moment';
import { ReportsService } from './reports.service';
import { AnalyticsFilterDto } from '../analytics/dto/analytics-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

export class GenerateReportDto {
  @ApiProperty({ example: 'monthly', enum: ['monthly', 'fleet', 'excel_revenue', 'excel_sessions', 'excel_energy'] })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'station-uuid' })
  @IsOptional()
  @IsString()
  stationId?: string;

  @ApiPropertyOptional({ example: 'fleet-uuid' })
  @IsOptional()
  @IsString()
  fleetAccountId?: string;

  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ example: 1, description: 'Month number (1-12)' })
  @IsOptional()
  @IsNumber()
  month?: number;

  @ApiPropertyOptional()
  @IsOptional()
  filters?: AnalyticsFilterDto;
}

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a report',
    description:
      'Generates and returns a PDF or Excel report. Supported types: monthly, fleet, excel_revenue, excel_sessions, excel_energy.',
  })
  @ApiResponse({ status: 200, description: 'Report generated and returned' })
  async generateReport(@Body() dto: GenerateReportDto, @Res() res) {
    const year = dto.year || new Date().getFullYear();
    const month = dto.month || new Date().getMonth() + 1;
    const filters = dto.filters || new AnalyticsFilterDto();

    if (dto.type === 'monthly') {
      if (!dto.stationId) {
        return res.status(400).json({ message: 'stationId required for monthly report' });
      }
      const pdf = await this.reportsService.generateMonthlyReport(
        dto.stationId,
        year,
        month,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ECNT_Monthly_${dto.stationId}_${year}${String(month).padStart(2, '0')}.pdf"`,
      });
      return res.end(pdf);
    }

    if (dto.type === 'fleet') {
      if (!dto.fleetAccountId) {
        return res.status(400).json({ message: 'fleetAccountId required for fleet report' });
      }
      const pdf = await this.reportsService.generateFleetReport(
        dto.fleetAccountId,
        filters,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ECNT_Fleet_${dto.fleetAccountId}_${moment().format('YYYYMM')}.pdf"`,
      });
      return res.end(pdf);
    }

    if (dto.type.startsWith('excel_')) {
      const dataType = dto.type.replace('excel_', '');
      const buffer = await this.reportsService.exportToExcel(dataType, filters);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ECNT_${dataType}_${moment().format('YYYYMMDD')}.xlsx"`,
      });
      return res.end(buffer);
    }

    return res.status(400).json({ message: `Unknown report type: ${dto.type}` });
  }

  @Get()
  @ApiOperation({ summary: 'List all generated reports' })
  @ApiResponse({ status: 200, description: 'Report list retrieved' })
  async listReports() {
    return this.reportsService.listReports();
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a previously generated report' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report downloaded' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async downloadReport(@Param('id') id: string, @Res() res) {
    const report = this.reportsService.getReport(id);
    res.json(report);
  }
}
