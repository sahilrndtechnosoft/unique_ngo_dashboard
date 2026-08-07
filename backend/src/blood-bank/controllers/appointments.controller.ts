import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AdminCreateAppointmentDto,
  AdminUpdateAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from '../dto/appointment.dto';
import { AppointmentsService } from '../services/appointments.service';

@ApiTags('Blood Donation Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ResponseMessage('Appointment booked successfully')
  book(@CurrentUser() user: JwtPayload, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.bookAppointment(user.sub, dto);
  }

  @Get()
  @ResponseMessage('Appointments fetched successfully')
  list(@CurrentUser() user: JwtPayload, @Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.listMyAppointments(user.sub, query);
  }

  @Patch(':id/cancel')
  @ResponseMessage('Appointment cancelled successfully')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentsService.cancelAppointment(user.sub, id, dto);
  }
}

@ApiTags('Admin - Blood Donation Appointments')
@ApiBearerAuth()
@Controller('admin/appointments')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminAppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Appointments fetched successfully')
  list(@Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.listAppointments(query, { donorId: query.userId });
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Appointment fetched successfully')
  get(@Param('id') id: string) {
    return this.appointmentsService.getAppointment(id);
  }

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Appointment created successfully')
  create(@Body() dto: AdminCreateAppointmentDto) {
    return this.appointmentsService.adminCreateAppointment(dto);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Appointment updated successfully')
  update(@Param('id') id: string, @Body() dto: AdminUpdateAppointmentDto) {
    return this.appointmentsService.adminUpdateAppointment(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Appointment deleted successfully')
  delete(@Param('id') id: string) {
    return this.appointmentsService.adminDeleteAppointment(id);
  }
}
