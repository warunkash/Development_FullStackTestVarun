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
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ChargersService } from './chargers.service';
import { CreateChargerDto, UpdateChargerDto, UpdateChargerStatusDto } from './dto/create-charger.dto';
import { ChargerStatus } from './charger.entity';

@ApiTags('chargers')
@ApiBearerAuth()
@Controller()
export class ChargersController {
  private readonly logger = new Logger(ChargersController.name);

  constructor(private readonly chargersService: ChargersService) {}

  @Post('stations/:stationId/chargers')
  @ApiOperation({ summary: 'Add a charger to a station (Admin/Operator)' })
  @ApiParam({ name: 'stationId', type: String })
  @ApiResponse({ status: 201, description: 'Charger added successfully' })
  async addCharger(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Body() dto: CreateChargerDto,
  ) {
    return this.chargersService.addCharger(stationId, { ...dto, stationId });
  }

  @Get('stations/:stationId/chargers')
  @ApiOperation({ summary: 'List all chargers for a station' })
  @ApiParam({ name: 'stationId', type: String })
  @ApiResponse({ status: 200, description: 'List of chargers' })
  async getStationChargers(@Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.chargersService.getStationChargers(stationId);
  }

  @Get('chargers/health')
  @ApiOperation({ summary: 'Get aggregate charger health statistics' })
  @ApiResponse({ status: 200, description: 'Charger health stats' })
  async getChargerHealth() {
    return this.chargersService.getChargerHealth();
  }

  @Get('chargers/:id')
  @ApiOperation({ summary: 'Get charger details' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Charger details' })
  @ApiResponse({ status: 404, description: 'Charger not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.chargersService.findById(id);
  }

  @Put('chargers/:id')
  @ApiOperation({ summary: 'Update charger details' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Charger updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChargerDto,
  ) {
    return this.chargersService.update(id, dto);
  }

  @Delete('chargers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a charger (Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Charger removed' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.chargersService.remove(id);
  }

  @Put('chargers/:id/status')
  @ApiOperation({ summary: 'Update charger or connector status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChargerStatusDto,
  ) {
    return this.chargersService.updateStatus(id, dto.status as ChargerStatus, dto.connectorId);
  }

  @Post('chargers/:id/firmware')
  @ApiOperation({ summary: 'Trigger firmware update for a charger' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Firmware update triggered' })
  async updateFirmware(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('firmwareUrl') firmwareUrl: string,
  ) {
    await this.chargersService.updateFirmware(id, firmwareUrl);
    return { message: 'Firmware update scheduled', chargerId: id, firmwareUrl };
  }
}
