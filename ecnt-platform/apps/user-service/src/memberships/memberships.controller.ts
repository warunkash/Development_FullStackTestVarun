import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

class SubscribeDto {
  planId: string;
  paymentId: string;
}

@ApiTags('memberships')
@Controller('memberships')
@UseGuards(new JwtAuthGuard(new Reflector()))
@ApiBearerAuth('JWT-auth')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all available membership plans' })
  @ApiResponse({ status: 200, description: 'List of active membership plans' })
  async getPlans() {
    return this.membershipsService.getPlans();
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to a membership plan' })
  @ApiBody({
    schema: {
      properties: {
        planId: { type: 'string', format: 'uuid' },
        paymentId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Membership activated' })
  @ApiResponse({ status: 409, description: 'Already has active membership' })
  async subscribe(@Request() req: any, @Body() dto: SubscribeDto) {
    return this.membershipsService.subscribeToPlan(req.user.id, dto.planId, dto.paymentId);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active membership' })
  @ApiResponse({ status: 200, description: 'Active membership or null' })
  async getCurrent(@Request() req: any) {
    return this.membershipsService.getUserMembership(req.user.id);
  }

  @Get('benefits')
  @ApiOperation({ summary: 'Get current membership benefits and discounts' })
  @ApiResponse({ status: 200, description: 'Membership benefits' })
  async getBenefits(@Request() req: any) {
    return this.membershipsService.checkMembershipBenefits(req.user.id);
  }

  @Delete('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel current membership (takes effect at period end)' })
  @ApiResponse({ status: 200, description: 'Membership cancelled' })
  @ApiResponse({ status: 404, description: 'No active membership' })
  async cancel(@Request() req: any) {
    return this.membershipsService.cancelMembership(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get membership history' })
  @ApiResponse({ status: 200, description: 'List of past memberships' })
  async getHistory(@Request() req: any) {
    return this.membershipsService.getMembershipHistory(req.user.id);
  }
}
