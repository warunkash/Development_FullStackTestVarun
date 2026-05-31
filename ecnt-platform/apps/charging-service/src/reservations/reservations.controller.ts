import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reservation for a future charging slot' })
  @ApiResponse({ status: 201, description: 'Reservation created' })
  @ApiResponse({ status: 409, description: 'Slot already reserved' })
  @ApiResponse({ status: 400, description: 'Invalid time range' })
  async create(@Body() dto: CreateReservationDto, @Req() req: any) {
    dto.userId = req.user?.id || req.headers['x-user-id'];
    return this.reservationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get current user reservations' })
  @ApiResponse({ status: 200, description: 'List of user reservations' })
  async findUserReservations(@Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return this.reservationsService.findUserReservations(userId);
  }

  @Get('slots')
  @ApiOperation({ summary: 'Get available time slots for a charger on a given date' })
  @ApiQuery({ name: 'chargerId', type: String })
  @ApiQuery({ name: 'date', type: String, description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, description: 'Available time slots' })
  async getAvailableSlots(
    @Query('chargerId', ParseUUIDPipe) chargerId: string,
    @Query('date') date: string,
  ) {
    const parsedDate = new Date(date);
    return this.reservationsService.getAvailableSlots(chargerId, parsedDate);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Reservation cancelled' })
  @ApiResponse({ status: 404, description: 'Reservation not found' })
  @ApiResponse({ status: 400, description: 'Cannot cancel reservation in current state' })
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const userId = req.user?.id || req.headers['x-user-id'];
    return this.reservationsService.cancel(id, userId);
  }
}
