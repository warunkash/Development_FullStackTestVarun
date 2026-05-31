import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { OcppGateway } from './ocpp.gateway';
import { OcppCommandsService } from './ocpp-commands.service';

@ApiTags('ocpp')
@ApiBearerAuth()
@Controller('ocpp')
export class OcppController {
  private readonly logger = new Logger(OcppController.name);

  constructor(
    private readonly gateway: OcppGateway,
    private readonly commandsService: OcppCommandsService,
  ) {}

  @Get('connected')
  @ApiOperation({ summary: 'List all currently connected charge points' })
  @ApiResponse({ status: 200, description: 'Connected charge point IDs with metadata' })
  getConnected() {
    const ids = this.gateway.getConnectedChargePoints();
    return {
      count: ids.length,
      chargePoints: ids.map((id) => ({
        chargePointId: id,
        ...this.gateway.getChargePointInfo(id),
      })),
    };
  }

  @Get(':chargePointId/status')
  @ApiOperation({ summary: 'Get connection status of a specific charge point' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiResponse({ status: 200, description: 'Connection status and metadata' })
  getStatus(@Param('chargePointId') chargePointId: string) {
    const connected = this.gateway.isConnected(chargePointId);
    const info = this.gateway.getChargePointInfo(chargePointId);
    return { chargePointId, connected, ...info };
  }

  @Post(':chargePointId/remote-start')
  @ApiOperation({ summary: 'Remotely start a charging transaction' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['connectorId', 'idTag'],
      properties: {
        connectorId: { type: 'number', example: 1 },
        idTag: { type: 'string', example: 'APP_USER_TOKEN_123' },
        chargingProfile: { type: 'object', description: 'Optional OCPP charging profile' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'RemoteStartTransaction result' })
  async remoteStart(
    @Param('chargePointId') chargePointId: string,
    @Body() body: { connectorId: number; idTag: string; chargingProfile?: any },
  ) {
    const { connectorId, idTag, chargingProfile } = body;
    if (!connectorId || !idTag) {
      throw new BadRequestException('connectorId and idTag are required');
    }
    return this.commandsService.remoteStartTransaction(chargePointId, connectorId, idTag, chargingProfile);
  }

  @Post(':chargePointId/remote-stop')
  @ApiOperation({ summary: 'Remotely stop a charging transaction' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['transactionId'],
      properties: { transactionId: { type: 'number', example: 1234567 } },
    },
  })
  @ApiResponse({ status: 200, description: 'RemoteStopTransaction result' })
  async remoteStop(
    @Param('chargePointId') chargePointId: string,
    @Body('transactionId') transactionId: number,
  ) {
    if (!transactionId) throw new BadRequestException('transactionId is required');
    return this.commandsService.remoteStopTransaction(chargePointId, transactionId);
  }

  @Post(':chargePointId/reset')
  @ApiOperation({ summary: 'Reset a charge point (Hard or Soft)' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type'],
      properties: { type: { type: 'string', enum: ['Hard', 'Soft'] } },
    },
  })
  @ApiResponse({ status: 200, description: 'Reset result' })
  async reset(
    @Param('chargePointId') chargePointId: string,
    @Body('type') type: 'Hard' | 'Soft',
  ) {
    if (!['Hard', 'Soft'].includes(type)) {
      throw new BadRequestException('type must be Hard or Soft');
    }
    return this.commandsService.reset(chargePointId, type);
  }

  @Post(':chargePointId/change-availability')
  @ApiOperation({ summary: 'Change connector availability' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['connectorId', 'type'],
      properties: {
        connectorId: { type: 'number', example: 1 },
        type: { type: 'string', enum: ['Operative', 'Inoperative'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'ChangeAvailability result' })
  async changeAvailability(
    @Param('chargePointId') chargePointId: string,
    @Body() body: { connectorId: number; type: 'Operative' | 'Inoperative' },
  ) {
    const { connectorId, type } = body;
    if (connectorId === undefined || !type) {
      throw new BadRequestException('connectorId and type are required');
    }
    return this.commandsService.changeAvailability(chargePointId, connectorId, type);
  }

  @Get(':chargePointId/configuration')
  @ApiOperation({ summary: 'Get charge point configuration' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiResponse({ status: 200, description: 'Configuration key-value pairs' })
  async getConfiguration(@Param('chargePointId') chargePointId: string) {
    return this.commandsService.getConfiguration(chargePointId);
  }

  @Put(':chargePointId/configuration')
  @ApiOperation({ summary: 'Change a charge point configuration key' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        key: { type: 'string', example: 'HeartbeatInterval' },
        value: { type: 'string', example: '300' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'ChangeConfiguration result' })
  async changeConfiguration(
    @Param('chargePointId') chargePointId: string,
    @Body() body: { key: string; value: string },
  ) {
    const { key, value } = body;
    if (!key || value === undefined) throw new BadRequestException('key and value are required');
    return this.commandsService.changeConfiguration(chargePointId, key, value);
  }

  @Post(':chargePointId/update-firmware')
  @ApiOperation({ summary: 'Trigger firmware update on a charge point' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['location', 'retrieveDate'],
      properties: {
        location: { type: 'string', example: 'https://firmware.ecnt.in/v2.1.bin' },
        retrieveDate: { type: 'string', example: '2024-01-15T14:30:00Z' },
        retries: { type: 'number', example: 3 },
        retryInterval: { type: 'number', example: 60 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'UpdateFirmware command sent' })
  async updateFirmware(
    @Param('chargePointId') chargePointId: string,
    @Body() body: { location: string; retrieveDate: string; retries?: number; retryInterval?: number },
  ) {
    const { location, retrieveDate, retries, retryInterval } = body;
    if (!location || !retrieveDate) throw new BadRequestException('location and retrieveDate are required');
    await this.commandsService.updateFirmware(chargePointId, location, retrieveDate, retries, retryInterval);
    return { message: 'UpdateFirmware command sent', chargePointId, location, retrieveDate };
  }

  @Post(':chargePointId/clear-cache')
  @ApiOperation({ summary: 'Clear the authorization cache on a charge point' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiResponse({ status: 200, description: 'ClearCache result' })
  async clearCache(@Param('chargePointId') chargePointId: string) {
    return this.commandsService.clearCache(chargePointId);
  }

  @Post(':chargePointId/unlock-connector')
  @ApiOperation({ summary: 'Unlock a connector on a charge point' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['connectorId'],
      properties: { connectorId: { type: 'number', example: 1 } },
    },
  })
  @ApiResponse({ status: 200, description: 'UnlockConnector result' })
  async unlockConnector(
    @Param('chargePointId') chargePointId: string,
    @Body('connectorId') connectorId: number,
  ) {
    if (!connectorId) throw new BadRequestException('connectorId is required');
    return this.commandsService.unlockConnector(chargePointId, connectorId);
  }

  @Post(':chargePointId/trigger-message')
  @ApiOperation({ summary: 'Trigger a message from the charge point' })
  @ApiParam({ name: 'chargePointId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['requestedMessage'],
      properties: {
        requestedMessage: {
          type: 'string',
          enum: ['BootNotification', 'DiagnosticsStatusNotification', 'FirmwareStatusNotification', 'Heartbeat', 'MeterValues', 'StatusNotification'],
        },
        connectorId: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'TriggerMessage result' })
  async triggerMessage(
    @Param('chargePointId') chargePointId: string,
    @Body() body: { requestedMessage: string; connectorId?: number },
  ) {
    const { requestedMessage, connectorId } = body;
    if (!requestedMessage) throw new BadRequestException('requestedMessage is required');
    return this.commandsService.triggerMessage(chargePointId, requestedMessage, connectorId);
  }
}
