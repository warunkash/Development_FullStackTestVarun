import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto, AddVehicleModelDto, VehicleFilterDto } from './dto/create-vehicle.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { RolesGuard } from '../users/guards/roles.guard';
import { Reflector } from '@nestjs/core';

@ApiTags('vehicles')
@Controller('vehicles')
@UseGuards(new JwtAuthGuard(new Reflector()))
@ApiBearerAuth('JWT-auth')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new vehicle for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Vehicle added' })
  @ApiResponse({ status: 409, description: 'Registration number already registered' })
  async addVehicle(@Body() dto: CreateVehicleDto, @Request() req: any) {
    return this.vehiclesService.addVehicle(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vehicles for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of vehicles' })
  async getUserVehicles(@Request() req: any) {
    return this.vehiclesService.getUserVehicles(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vehicle details by ID' })
  @ApiResponse({ status: 200, description: 'Vehicle details' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getVehicle(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const vehicle = await this.vehiclesService.findVehicleById(id);
    if (vehicle.userId !== req.user.id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot access another user vehicle');
    }
    return vehicle;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update vehicle details' })
  @ApiResponse({ status: 200, description: 'Vehicle updated' })
  async updateVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @Request() req: any,
  ) {
    return this.vehiclesService.updateVehicle(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle removed' })
  async removeVehicle(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.vehiclesService.removeVehicle(req.user.id, id);
  }

  @Get('/models/search')
  @ApiOperation({ summary: 'Search vehicle models' })
  @ApiResponse({ status: 200, description: 'List of vehicle models' })
  async getVehicleModels(@Query() filters: VehicleFilterDto) {
    return this.vehiclesService.getVehicleModels(filters);
  }

  @Post('/models')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add new vehicle model (admin only)' })
  @ApiResponse({ status: 201, description: 'Vehicle model added' })
  async addVehicleModel(@Body() dto: AddVehicleModelDto, @Request() req: any) {
    if (!req.user.roles.includes('admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.vehiclesService.addVehicleModel(dto);
  }
}
