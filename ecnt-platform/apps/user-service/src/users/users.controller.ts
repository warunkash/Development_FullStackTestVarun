import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Reflector } from '@nestjs/core';

@ApiTags('users')
@Controller('users')
@UseGuards(new JwtAuthGuard(new Reflector()))
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(new RolesGuard(new Reflector()))
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of users' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async findAll(@Query() filterDto: UserFilterDto, @Request() req: any) {
    if (!req.user.roles.includes('admin')) {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot access another user profile');
    }
    return this.usersService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot update another user profile');
    }
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot deactivate another user account');
    }
    return this.usersService.deactivate(id);
  }

  @Post(':id/upload-avatar')
  @ApiOperation({ summary: 'Upload user profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot upload avatar for another user');
    }
    return this.usersService.uploadProfileImage(id, file);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get user charging statistics' })
  @ApiResponse({ status: 200, description: 'User stats' })
  async getStats(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot access another user stats');
    }
    return this.usersService.getStats(id);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get user recent activity' })
  async getActivity(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (req.user.id !== id && !req.user.roles.includes('admin')) {
      throw new ForbiddenException('Cannot access another user activity');
    }
    const user = await this.usersService.findById(id);
    // In a real system, this would fetch from an activity/audit log service
    return {
      userId: id,
      lastLogin: user.lastLoginAt,
      recentSessions: [],
      recentTransactions: [],
    };
  }
}
