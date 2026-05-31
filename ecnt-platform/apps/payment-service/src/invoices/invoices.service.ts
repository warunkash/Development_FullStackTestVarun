import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { InvoiceEntity, InvoiceItemEntity, InvoiceStatus } from './invoice.entity';
import { PaymentEntity, PaymentType } from '../payments/payment.entity';

export interface InvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
  hsnCode?: string;
  gstRate?: number;
}

export interface CreateInvoiceDto {
  userId: string;
  paymentId?: string;
  sessionId?: string;
  fleetAccountId?: string;
  billingName: string;
  billingEmail: string;
  billingPhone?: string;
  billingAddress?: string;
  gstin?: string;
  items: InvoiceItemDto[];
  notes?: string;
  discountAmount?: number;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    @InjectRepository(InvoiceItemEntity)
    private readonly invoiceItemRepository: Repository<InvoiceItemEntity>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    // Get count of invoices this month for sequential numbering
    const count = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where(`EXTRACT(YEAR FROM invoice.created_at) = :year`, { year })
      .andWhere(`EXTRACT(MONTH FROM invoice.created_at) = :month`, {
        month: new Date().getMonth() + 1,
      })
      .getCount();

    const seq = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}-${seq}`;
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<InvoiceEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoiceNumber = await this.generateInvoiceNumber();

      // Calculate amounts
      const subtotal = dto.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const discountAmount = dto.discountAmount || 0;
      const taxableAmount = subtotal - discountAmount;

      // Calculate GST (using first item's rate as primary, or 5% default)
      const primaryGstRate = dto.items[0]?.gstRate ?? 5;
      const cgstAmount = Math.round(taxableAmount * (primaryGstRate / 2) * 100) / 100;
      const sgstAmount = Math.round(taxableAmount * (primaryGstRate / 2) * 100) / 100;
      const totalAmount = Math.round((taxableAmount + cgstAmount + sgstAmount) * 100) / 100;

      // Create invoice
      const invoice = queryRunner.manager.create(InvoiceEntity, {
        invoiceNumber,
        userId: dto.userId,
        paymentId: dto.paymentId,
        sessionId: dto.sessionId,
        fleetAccountId: dto.fleetAccountId,
        status: InvoiceStatus.ISSUED,
        billingName: dto.billingName,
        billingEmail: dto.billingEmail,
        billingPhone: dto.billingPhone,
        billingAddress: dto.billingAddress,
        gstin: dto.gstin,
        subtotal: Math.round(subtotal * 100) / 100,
        cgstAmount,
        sgstAmount,
        igstAmount: 0,
        discountAmount: Math.round(discountAmount * 100) / 100,
        totalAmount,
        currency: 'INR',
        notes: dto.notes,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paidAt: dto.paymentId ? new Date() : null,
      });

      await queryRunner.manager.save(invoice);

      // Create invoice items
      const items = dto.items.map((item) =>
        queryRunner.manager.create(InvoiceItemEntity, {
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
          unit: item.unit || 'unit',
          hsnCode: item.hsnCode || '998519',
          gstRate: item.gstRate ?? 5,
        }),
      );

      await queryRunner.manager.save(items);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Invoice ${invoiceNumber} created for user ${dto.userId}, total: ₹${totalAmount}`,
      );

      return this.invoiceRepository.findOne({
        where: { id: invoice.id },
        relations: ['items'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Invoice creation failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createInvoiceForPayment(payment: PaymentEntity): Promise<InvoiceEntity> {
    // Determine GST rate based on payment type
    const gstRate =
      payment.type === PaymentType.CHARGING_SESSION
        ? 5
        : payment.type === PaymentType.CAFE_ORDER || payment.type === PaymentType.WATER_SALE
        ? 18
        : 18;

    const hsnCode =
      payment.type === PaymentType.CHARGING_SESSION ? '998519' : '996311';

    const baseAmount =
      Number(payment.amount) / (1 + gstRate / 100);
    const gstAmount = Number(payment.amount) - baseAmount;

    return this.createInvoice({
      userId: payment.userId,
      paymentId: payment.id,
      sessionId: payment.sessionId,
      fleetAccountId: payment.fleetAccountId,
      billingName: `ECNT Customer - ${payment.userId}`,
      billingEmail: payment.metadata?.email || 'customer@ecnt.in',
      billingPhone: payment.metadata?.phone,
      items: [
        {
          description: this.getPaymentDescription(payment.type),
          quantity: 1,
          unitPrice: baseAmount,
          unit: payment.type === PaymentType.CHARGING_SESSION ? 'session' : 'unit',
          hsnCode,
          gstRate,
        },
      ],
      notes: `Payment ID: ${payment.id}`,
    });
  }

  private getPaymentDescription(type: PaymentType): string {
    const descriptions: Record<string, string> = {
      [PaymentType.CHARGING_SESSION]: 'EV Charging Session',
      [PaymentType.WALLET_TOPUP]: 'Wallet Top-up',
      [PaymentType.MEMBERSHIP]: 'Membership Subscription',
      [PaymentType.FLEET_BILLING]: 'Fleet Charging Services',
      [PaymentType.CAFE_ORDER]: 'Cafe Order',
      [PaymentType.WATER_SALE]: 'Water Sale',
    };
    return descriptions[type] || 'ECNT Service';
  }

  async getInvoice(invoiceId: string, userId?: string): Promise<InvoiceEntity> {
    const whereClause: any = { id: invoiceId };
    if (userId) whereClause.userId = userId;

    const invoice = await this.invoiceRepository.findOne({
      where: whereClause,
      relations: ['items'],
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    return invoice;
  }

  async getUserInvoices(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: InvoiceEntity[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.invoiceRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['items'],
      skip,
      take: limit,
    });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async downloadInvoice(invoiceId: string, userId?: string): Promise<Buffer> {
    const invoice = await this.getInvoice(invoiceId, userId);
    return this.generatePdf(invoice);
  }

  private generatePdf(invoice: InvoiceEntity): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc
        .fillColor('#2563EB')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('ECNT', 50, 50)
        .fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
        .text('EV Charge Network Telangana', 50, 80)
        .text('Hyderabad, Telangana - 500001', 50, 95)
        .text('GSTIN: 36AABCE1234F1ZK', 50, 110)
        .text('support@ecnt.in | www.ecnt.in', 50, 125);

      // Invoice title
      doc
        .fillColor('#2563EB')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', 350, 50, { align: 'right' })
        .fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice No: ${invoice.invoiceNumber}`, 350, 80, { align: 'right' })
        .text(
          `Date: ${invoice.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
          350,
          95,
          { align: 'right' },
        )
        .text(`Status: ${invoice.status.toUpperCase()}`, 350, 110, { align: 'right' });

      // Horizontal rule
      doc
        .moveTo(50, 155)
        .lineTo(545, 155)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();

      // Bill to
      doc
        .fillColor('#6B7280')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('BILL TO', 50, 170)
        .fillColor('#111827')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(invoice.billingName, 50, 185)
        .font('Helvetica')
        .fontSize(10)
        .text(invoice.billingEmail, 50, 200);

      if (invoice.billingPhone) {
        doc.text(invoice.billingPhone, 50, 215);
      }
      if (invoice.billingAddress) {
        doc.text(invoice.billingAddress, 50, 230, { width: 200 });
      }
      if (invoice.gstin) {
        doc.text(`GSTIN: ${invoice.gstin}`, 50, 250);
      }

      // Items table header
      const tableTop = 290;
      const tableHeaders = ['Description', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'];
      const colWidths = [170, 60, 40, 40, 80, 80];
      const colPositions = [50, 220, 280, 320, 360, 440];

      doc.fillColor('#F3F4F6').rect(50, tableTop, 495, 20).fill();
      doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold');

      tableHeaders.forEach((header, i) => {
        const align = i >= 2 ? 'right' : 'left';
        doc.text(header, colPositions[i], tableTop + 6, {
          width: colWidths[i],
          align,
        });
      });

      // Items
      let y = tableTop + 28;
      doc.font('Helvetica').fontSize(9).fillColor('#111827');

      invoice.items.forEach((item, index) => {
        if (index % 2 === 0) {
          doc.fillColor('#FAFAFA').rect(50, y - 4, 495, 20).fill();
        }
        doc.fillColor('#111827');
        doc.text(item.description, colPositions[0], y, { width: colWidths[0] });
        doc.text(item.hsnCode || '', colPositions[1], y, { width: colWidths[1] });
        doc.text(String(item.quantity), colPositions[2], y, { width: colWidths[2], align: 'right' });
        doc.text(item.unit, colPositions[3], y, { width: colWidths[3], align: 'right' });
        doc.text(`₹${Number(item.unitPrice).toFixed(2)}`, colPositions[4], y, { width: colWidths[4], align: 'right' });
        doc.text(`₹${Number(item.totalPrice).toFixed(2)}`, colPositions[5], y, { width: colWidths[5], align: 'right' });
        y += 22;
      });

      // Totals
      y += 15;
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
      y += 10;

      const totalsLeft = 360;
      const totalsRight = 495;

      const addTotalRow = (label: string, amount: number, bold = false) => {
        doc
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(9)
          .fillColor('#374151')
          .text(label, totalsLeft, y, { width: 75 })
          .text(`₹${amount.toFixed(2)}`, totalsRight, y, { width: 60, align: 'right' });
        y += 16;
      };

      addTotalRow('Subtotal', Number(invoice.subtotal));
      if (Number(invoice.discountAmount) > 0) {
        addTotalRow('Discount', -Number(invoice.discountAmount));
      }
      addTotalRow(`CGST (${(Number(invoice.cgstAmount) / Number(invoice.subtotal) * 100).toFixed(1)}%)`, Number(invoice.cgstAmount));
      addTotalRow(`SGST (${(Number(invoice.sgstAmount) / Number(invoice.subtotal) * 100).toFixed(1)}%)`, Number(invoice.sgstAmount));

      doc.moveTo(totalsLeft, y).lineTo(555, y).stroke();
      y += 6;
      addTotalRow('TOTAL', Number(invoice.totalAmount), true);

      // Footer
      const pageHeight = doc.page.height;
      doc
        .fillColor('#9CA3AF')
        .fontSize(8)
        .font('Helvetica')
        .text('This is a computer-generated invoice. No signature required.', 50, pageHeight - 80, {
          align: 'center',
          width: 495,
        })
        .text('Thank you for choosing ECNT - Driving the Green Future of Telangana!', 50, pageHeight - 65, {
          align: 'center',
          width: 495,
        });

      doc.end();
    });
  }
}
