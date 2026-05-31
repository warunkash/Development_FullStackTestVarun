import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { StartSessionDto } from './dto/start-session.dto';
import { StopSessionDto } from './dto/stop-session.dto';
import { PaginationDto } from '../stations/dto/station-filter.dto';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a charging session' })
  @ApiResponse({ status: 201, description: 'Session started successfully' })
  @ApiResponse({ status: 409, description: 'Charger is occupied or user already has active session' })
  @ApiResponse({ status: 400, description: 'Charger is not available' })
  async startSession(@Body() dto: StartSessionDto, @Req() req: any) {
    // In production, inject userId from JWT auth middleware
    dto.userId = req.user?.id || req.headers['x-user-id'];
    return this.sessionsService.startSession(dto);
  }

  @Put(':id/stop')
  @ApiOperation({ summary: 'Stop a charging session' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session stopped, cost calculated' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 400, description: 'Session is not active' })
  async stopSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StopSessionDto,
  ) {
    return this.sessionsService.stopSession(id, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the current user active session' })
  @ApiResponse({ status: 200, description: 'Active session or null' })
  async getActiveSession(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return this.sessionsService.findActiveSession(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get current user session history' })
  @ApiResponse({ status: 200, description: 'Paginated session history' })
  async getHistory(@Req() req: any, @Query() pagination: PaginationDto) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return this.sessionsService.findUserSessions(userId, pagination);
  }

  @Get('station/:stationId')
  @ApiOperation({ summary: 'Get sessions for a station (Admin/Operator)' })
  @ApiParam({ name: 'stationId', type: String })
  @ApiResponse({ status: 200, description: 'Paginated station sessions' })
  async getStationSessions(
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.sessionsService.findStationSessions(stationId, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session details with meter values' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Session details with meter values' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionDetails(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.getSessionDetails(id);
  }
}
