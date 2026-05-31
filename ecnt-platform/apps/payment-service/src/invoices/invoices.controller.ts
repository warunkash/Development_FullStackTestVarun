import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Response,
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
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all invoices for the authenticated user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Invoice list retrieved' })
  async getUserInvoices(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.invoicesService.getUserInvoices(req.user.id, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific invoice' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Request() req, @Param('id') id: string) {
    return this.invoicesService.getInvoice(id, req.user.id);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download invoice as PDF',
    description: 'Generates and streams a PDF invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'PDF invoice downloaded', content: { 'application/pdf': {} } })
  async downloadInvoice(
    @Request() req,
    @Param('id') id: string,
    @Response() res,
  ) {
    const invoice = await this.invoicesService.getInvoice(id, req.user.id);
    const pdfBuffer = await this.invoicesService.downloadInvoice(id, req.user.id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(pdfBuffer);
  }
}
