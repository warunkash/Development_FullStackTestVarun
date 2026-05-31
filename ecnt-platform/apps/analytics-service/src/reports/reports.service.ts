import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import * as PDFDocument from 'pdfkit';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsFilterDto, AnalyticsPeriod } from '../analytics/dto/analytics-filter.dto';

export interface ReportRecord {
  id: string;
  type: string;
  name: string;
  status: 'pending' | 'completed' | 'failed';
  generatedAt: Date;
  downloadUrl?: string;
  params: Record<string, any>;
}

// In-memory report registry (replace with DB in production)
const reportRegistry: Map<string, ReportRecord> = new Map();

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async generateMonthlyReport(
    stationId: string,
    year: number,
    month: number,
  ): Promise<Buffer> {
    this.logger.log(`Generating monthly report for station ${stationId}, ${year}-${month}`);

    const startDate = moment(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month');
    const endDate = startDate.clone().endOf('month');

    const filters: AnalyticsFilterDto = {
      period: AnalyticsPeriod.CUSTOM,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
      stationId,
    };

    const [revenue, energy, sessions, carbon] = await Promise.all([
      this.analyticsService.getRevenueMetrics(filters),
      this.analyticsService.getEnergyMetrics(filters),
      this.analyticsService.getSessionMetrics(filters),
      this.analyticsService.getCarbonSavings(filters),
    ]);

    return this.buildMonthlyPdf({
      stationId,
      year,
      month,
      revenue,
      energy,
      sessions,
      carbon,
      period: `${startDate.format('MMMM YYYY')}`,
    });
  }

  private buildMonthlyPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Cover page
      doc.fillColor('#2563EB').rect(0, 0, doc.page.width, 200).fill();
      doc
        .fillColor('white')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text('ECNT Monthly Report', 50, 70)
        .fontSize(16)
        .font('Helvetica')
        .text(data.period, 50, 110)
        .text(`Station: ${data.stationId}`, 50, 135);

      doc.fillColor('#111827').moveDown(5);

      // Summary section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563EB').text('Executive Summary', 50);
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#2563EB').stroke();
      doc.moveDown(0.5);

      const addMetric = (label: string, value: string) => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#374151')
          .text(`${label}: `, { continued: true })
          .font('Helvetica')
          .text(value);
      };

      addMetric('Total Revenue', `₹${Number(data.revenue.total).toLocaleString('en-IN')}`);
      addMetric('Total Energy Delivered', `${data.energy.totalKwh} kWh`);
      addMetric('Total Sessions', String(data.sessions.total));
      addMetric('Session Completion Rate', `${data.sessions.completionRate}%`);
      addMetric('Avg Session Duration', `${data.sessions.avgDurationMin} minutes`);
      addMetric('CO2 Saved', `${data.carbon.co2SavedKg} kg`);
      addMetric('Trees Equivalent', String(data.carbon.treesEquivalent));
      addMetric('Fuel Saved', `${data.carbon.fuelSavedLitres} litres`);

      doc.moveDown(1);

      // Revenue breakdown
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563EB').text('Revenue Breakdown');
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
      doc.moveDown(0.5);

      if (data.revenue.byPaymentMethod?.length) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text('By Payment Method:');
        data.revenue.byPaymentMethod.forEach((m) => {
          doc.font('Helvetica').text(`  ${m.method.toUpperCase()}: ₹${Number(m.amount).toFixed(2)} (${m.count} transactions)`);
        });
      }

      doc.moveDown(1);

      // Energy section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563EB').text('Energy Analytics');
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      addMetric('Solar Energy', `${data.energy.solarVsGrid.solarKwh} kWh (${data.energy.solarVsGrid.solarPercent}%)`);
      addMetric('Grid Energy', `${data.energy.solarVsGrid.gridKwh} kWh`);
      addMetric('Peak Demand', `${data.energy.peakDemandKw} kW`);
      addMetric('Avg per Session', `${data.energy.avgKwhPerSession} kWh`);

      // Footer
      const pageHeight = doc.page.height;
      doc
        .fillColor('#9CA3AF')
        .fontSize(8)
        .text(
          `Generated by ECNT Analytics on ${moment().format('DD-MM-YYYY HH:mm')} IST`,
          50,
          pageHeight - 60,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }

  async generateFleetReport(
    fleetAccountId: string,
    filters: AnalyticsFilterDto,
  ): Promise<Buffer> {
    this.logger.log(`Generating fleet report for ${fleetAccountId}`);
    const fleetData = await this.analyticsService.getFleetMetrics(fleetAccountId, filters);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fillColor('#1D4ED8').rect(0, 0, doc.page.width, 150).fill();
      doc
        .fillColor('white')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Fleet Charging Report', 50, 50)
        .fontSize(12)
        .font('Helvetica')
        .text(`Fleet Account: ${fleetAccountId}`, 50, 85)
        .text(
          `Period: ${moment(fleetData.period.start).format('DD MMM YYYY')} - ${moment(fleetData.period.end).format('DD MMM YYYY')}`,
          50,
          105,
        );

      doc.fillColor('#111827').moveDown(5);

      // Fleet summary
      doc.fontSize(13).font('Helvetica-Bold').text('Fleet Summary');
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#1D4ED8').stroke();
      doc.moveDown(0.5);

      const s = fleetData.summary;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Sessions: ${s.totalSessions}`);
      doc.text(`Total Energy: ${s.totalKwh} kWh`);
      doc.text(`Total Cost: ₹${Number(s.totalCost).toLocaleString('en-IN')}`);
      doc.text(`Avg Cost / Session: ₹${s.avgCostPerSession}`);
      doc.text(`Active Vehicles: ${s.activeVehicles} / ${s.totalVehicles}`);

      doc.moveDown(1);

      // Per-vehicle table
      doc.fontSize(13).font('Helvetica-Bold').text('Vehicle Breakdown');
      doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
      doc.moveDown(0.5);

      // Table header
      const headers = ['License Plate', 'Driver', 'Sessions', 'kWh', 'Cost (INR)'];
      const colX = [50, 160, 270, 340, 420];
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151');
      headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: 100 }));

      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9);

      fleetData.vehicles.forEach((v, idx) => {
        const y = doc.y;
        if (idx % 2 === 0) {
          doc.fillColor('#F9FAFB').rect(50, y - 2, 495, 16).fill();
        }
        doc.fillColor('#111827');
        doc.text(v.licensePlate, colX[0], y, { width: 100 });
        doc.text(v.driverName || 'N/A', colX[1], y, { width: 100 });
        doc.text(String(v.sessions), colX[2], y, { width: 60 });
        doc.text(String(v.totalKwh), colX[3], y, { width: 70 });
        doc.text(Number(v.totalCost).toFixed(2), colX[4], y, { width: 80 });
        doc.moveDown(0.4);
      });

      doc
        .fillColor('#9CA3AF')
        .fontSize(8)
        .text(
          `Generated by ECNT Analytics on ${moment().format('DD-MM-YYYY HH:mm')} IST`,
          50,
          doc.page.height - 60,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }

  async exportToExcel(type: string, filters: AnalyticsFilterDto): Promise<Buffer> {
    this.logger.log(`Exporting ${type} data to Excel`);

    // Dynamic import to avoid startup overhead
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ECNT Analytics';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(type.toUpperCase());

    switch (type) {
      case 'revenue': {
        const data = await this.analyticsService.getRevenueMetrics(filters);
        sheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Revenue (INR)', key: 'amount', width: 18 },
          { header: 'Session Count', key: 'sessionCount', width: 16 },
        ];
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        data.daily.forEach((d) => sheet.addRow(d));
        break;
      }

      case 'sessions': {
        const data = await this.analyticsService.getSessionMetrics(filters);
        sheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Total Sessions', key: 'count', width: 16 },
          { header: 'Completed', key: 'completed', width: 16 },
        ];
        sheet.getRow(1).font = { bold: true };
        data.daily.forEach((d) => sheet.addRow(d));
        break;
      }

      case 'energy': {
        const data = await this.analyticsService.getEnergyMetrics(filters);
        sheet.columns = [
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Energy (kWh)', key: 'kwh', width: 16 },
        ];
        sheet.getRow(1).font = { bold: true };
        data.daily.forEach((d) => sheet.addRow(d));
        break;
      }

      default:
        sheet.addRow(['No data available for type: ' + type]);
    }

    // Auto-filter
    if (sheet.rowCount > 1) {
      sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columnCount } };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  listReports(): ReportRecord[] {
    return Array.from(reportRegistry.values()).sort(
      (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
    );
  }

  getReport(id: string): ReportRecord {
    const report = reportRegistry.get(id);
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }
}
