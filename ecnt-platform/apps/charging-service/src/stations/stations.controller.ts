import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  ParseFloatPipe,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { StationsService } from './stations.service';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { StationFilterDto } from './dto/station-filter.dto';
import { StationStatus } from './station.entity';

@ApiTags('stations')
@ApiBearerAuth()
@Controller('stations')
export class StationsController {
  private readonly logger = new Logger(StationsController.name);

  constructor(private readonly stationsService: StationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new charging station (Admin/Operator)' })
  @ApiResponse({ status: 201, description: 'Station created successfully' })
  @ApiResponse({ status: 409, description: 'Station code already exists' })
  async create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all stations with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of stations' })
  async findAll(@Query() filter: StationFilterDto) {
    return this.stationsService.findAll(filter);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find charging stations near a location' })
  @ApiQuery({ name: 'lat', type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lng', type: Number, description: 'Longitude' })
  @ApiQuery({ name: 'radius', type: Number, required: false, description: 'Radius in km (default: 10)' })
  @ApiResponse({ status: 200, description: 'Nearby stations with distance' })
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius') radius?: string,
  ) {
    const radiusKm = radius ? parseFloat(radius) : 10;
    return this.stationsService.findNearby(lat, lng, radiusKm);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get station details with chargers and connectors' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Station details' })
  @ApiResponse({ status: 404, description: 'Station not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.stationsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update station details (Admin/Operator)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Station updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStationDto,
  ) {
    return this.stationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a station (Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Station deleted' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.stationsService.delete(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get station revenue/energy/session statistics' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'period', required: false, description: 'Period: 7d, 30d, 90d (default: 30d)' })
  @ApiResponse({ status: 200, description: 'Station statistics' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('period') period: string = '30d',
  ) {
    return this.stationsService.getStationStats(id, period);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Upload station images (Admin/Operator)' })
  @ApiParam({ name: 'id', type: String })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  async uploadImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.stationsService.uploadImages(id, files);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update station operational status' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: StationStatus,
  ) {
    return this.stationsService.setOperationalStatus(id, status);
  }
}
