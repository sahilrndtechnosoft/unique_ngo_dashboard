import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  appointment_status,
  blood_campaigns,
  blood_donation_appointments,
  campaign_status,
  hospitals,
  Prisma,
  users,
} from '../../../generated/prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminCreateAppointmentDto,
  AdminUpdateAppointmentDto,
  CreateAppointmentDto,
  ListAppointmentsQueryDto,
  UpdateAppointmentStatusDto,
} from '../dto/appointment.dto';
import { EligibilityService } from './eligibility.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibilityService: EligibilityService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async bookAppointment(donorId: string, dto: CreateAppointmentDto) {
    await this.validateHospitalOrCampaign(dto.hospitalId, dto.campaignId);

    const eligibility = await this.eligibilityService.checkEligibility(
      donorId,
      {
        lastDonationDate: dto.lastDonationDate,
        hadTattooRecently: dto.hadTattooRecently,
        tattooDate: dto.tattooDate,
      },
      { useAccountHistory: dto.forSelf !== false },
    );
    if (!eligibility.eligible) {
      throw new BadRequestException(eligibility.reasons.join(' '));
    }

    const appointment = await this.createAppointmentRecord(donorId, dto);
    await this.notifyAdminsOfNewAppointment(appointment.id, dto);
    return appointment;
  }

  async adminCreateAppointment(dto: AdminCreateAppointmentDto) {
    const donor = await this.prisma.users.findFirst({ where: { id: dto.userId, deleted_at: null } });
    if (!donor) {
      throw new NotFoundException('User not found');
    }
    await this.validateHospitalOrCampaign(dto.hospitalId, dto.campaignId);

    return this.createAppointmentRecord(dto.userId, dto);
  }

  private async createAppointmentRecord(donorId: string, dto: CreateAppointmentDto) {
    const appointment = await this.prisma.blood_donation_appointments.create({
      data: {
        donor_id: donorId,
        hospital_id: dto.hospitalId,
        campaign_id: dto.campaignId,
        blood_group: dto.bloodGroup,
        appointment_date: new Date(dto.appointmentDate),
        time_slot: dto.timeSlot,
        notes: dto.notes,
        for_self: dto.forSelf ?? true,
        beneficiary_name: dto.forSelf === false ? dto.beneficiaryName : null,
        beneficiary_mobile: dto.forSelf === false ? dto.beneficiaryMobile : null,
        beneficiary_relation: dto.forSelf === false ? dto.beneficiaryRelation : null,
      },
    });

    return this.toPublic(appointment);
  }

  async listMyAppointments(donorId: string, query: ListAppointmentsQueryDto) {
    return this.listAppointments(query, { donorId });
  }

  async listAppointments(query: ListAppointmentsQueryDto, options?: { donorId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let matchingDonorIds: string[] | undefined;
    if (query.search) {
      const donors = await this.prisma.users.findMany({
        where: {
          deleted_at: null,
          OR: [
            { full_name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { mobile: { contains: query.search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      matchingDonorIds = donors.map((donor) => donor.id);
    }

    const where: Prisma.blood_donation_appointmentsWhereInput = {
      ...(options?.donorId ? { donor_id: options.donorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
      ...(query.campaignId ? { campaign_id: query.campaignId } : {}),
      ...(query.search ? { donor_id: options?.donorId ? options.donorId : { in: matchingDonorIds } } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.blood_donation_appointments.count({ where }),
      this.prisma.blood_donation_appointments.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const [hospitalsById, campaignsById, donorsById] = await Promise.all([
      this.getHospitalsById(rows.map((row) => row.hospital_id)),
      this.getCampaignsById(rows.map((row) => row.campaign_id)),
      this.getDonorsById(rows.map((row) => row.donor_id)),
    ]);

    return {
      items: rows.map((row) =>
        this.toPublic(
          row,
          {
            hospital: hospitalsById.get(row.hospital_id ?? ''),
            campaign: campaignsById.get(row.campaign_id ?? ''),
          },
          donorsById.get(row.donor_id),
        ),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getAppointment(appointmentId: string) {
    const appointment = await this.findOrThrow(appointmentId);
    const [hospital, campaign, donor] = await Promise.all([
      appointment.hospital_id ? this.prisma.hospitals.findUnique({ where: { id: appointment.hospital_id } }) : null,
      appointment.campaign_id
        ? this.prisma.blood_campaigns.findUnique({ where: { id: appointment.campaign_id } })
        : null,
      this.prisma.users.findUnique({ where: { id: appointment.donor_id } }),
    ]);

    return this.toPublic(
      appointment,
      { hospital: hospital ?? undefined, campaign: campaign ?? undefined },
      donor ?? undefined,
    );
  }

  async adminUpdateAppointment(appointmentId: string, dto: AdminUpdateAppointmentDto) {
    const appointment = await this.findOrThrow(appointmentId);

    const nextHospitalId = dto.hospitalId !== undefined ? dto.hospitalId : appointment.hospital_id;
    const nextCampaignId = dto.campaignId !== undefined ? dto.campaignId : appointment.campaign_id;
    if (dto.hospitalId !== undefined || dto.campaignId !== undefined) {
      await this.validateHospitalOrCampaign(nextHospitalId ?? undefined, nextCampaignId ?? undefined);
    }

    const updated = await this.prisma.blood_donation_appointments.update({
      where: { id: appointmentId },
      data: {
        ...(dto.hospitalId !== undefined && { hospital_id: dto.hospitalId, campaign_id: null }),
        ...(dto.campaignId !== undefined && { campaign_id: dto.campaignId, hospital_id: null }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.appointmentDate !== undefined && { appointment_date: new Date(dto.appointmentDate) }),
        ...(dto.timeSlot !== undefined && { time_slot: dto.timeSlot }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.cancelReason !== undefined && { cancel_reason: dto.cancelReason }),
        ...(dto.forSelf !== undefined && { for_self: dto.forSelf }),
        ...(dto.beneficiaryName !== undefined && { beneficiary_name: dto.beneficiaryName }),
        ...(dto.beneficiaryMobile !== undefined && { beneficiary_mobile: dto.beneficiaryMobile }),
        ...(dto.beneficiaryRelation !== undefined && { beneficiary_relation: dto.beneficiaryRelation }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async adminDeleteAppointment(appointmentId: string) {
    await this.findOrThrow(appointmentId);
    await this.prisma.blood_donation_appointments.delete({ where: { id: appointmentId } });
  }

  async cancelAppointment(donorId: string, appointmentId: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.blood_donation_appointments.findFirst({
      where: { id: appointmentId, donor_id: donorId },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.status === appointment_status.COMPLETED) {
      throw new BadRequestException('Completed appointments cannot be cancelled');
    }

    const updated = await this.prisma.blood_donation_appointments.update({
      where: { id: appointmentId },
      data: {
        status: appointment_status.CANCELLED,
        cancel_reason: dto.cancelReason,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  private async validateHospitalOrCampaign(hospitalId?: string, campaignId?: string) {
    if (!hospitalId && !campaignId) {
      throw new BadRequestException('Either hospitalId or campaignId is required');
    }
    if (hospitalId && campaignId) {
      throw new BadRequestException('Book at a hospital or a camp, not both');
    }

    if (hospitalId) {
      const hospital = await this.prisma.hospitals.findFirst({
        where: { id: hospitalId, deleted_at: null, is_active: true },
      });
      if (!hospital) {
        throw new NotFoundException('Hospital not found or inactive');
      }
    }

    if (campaignId) {
      const campaign = await this.prisma.blood_campaigns.findFirst({
        where: { id: campaignId, deleted_at: null },
      });
      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }
      if (campaign.status !== campaign_status.ACTIVE) {
        throw new BadRequestException('Campaign is not currently active for bookings');
      }
    }
  }

  /** Best-effort admin email — a delivery failure must not fail the underlying booking. */
  private async notifyAdminsOfNewAppointment(appointmentId: string, dto: CreateAppointmentDto) {
    try {
      const appointment = await this.findOrThrow(appointmentId);
      const [donor, hospital, campaign] = await Promise.all([
        this.prisma.users.findUnique({ where: { id: appointment.donor_id } }),
        appointment.hospital_id ? this.prisma.hospitals.findUnique({ where: { id: appointment.hospital_id } }) : null,
        appointment.campaign_id ? this.prisma.blood_campaigns.findUnique({ where: { id: appointment.campaign_id } }) : null,
      ]);

      const donorLabel = dto.forSelf === false ? `${dto.beneficiaryName} (booked by ${donor?.full_name ?? 'a donor'})` : donor?.full_name ?? 'A donor';

      await this.notificationsService.notifyAdminsByEmail(
        `New Appointment Booked: ${donorLabel}`,
        `<p>A new blood donation appointment has been booked.</p>
         <ul>
           <li><strong>Donor:</strong> ${donorLabel}</li>
           <li><strong>Blood Group:</strong> ${appointment.blood_group.replace('_', ' ')}</li>
           <li><strong>Date:</strong> ${appointment.appointment_date.toISOString().slice(0, 10)}${appointment.time_slot ? ` (${appointment.time_slot})` : ''}</li>
           <li><strong>Location:</strong> ${hospital?.name ?? campaign?.name ?? '—'}</li>
         </ul>
         <p>Please review it in the admin panel.</p>`,
      );
    } catch (error) {
      this.logger.error(`Failed to email admins about appointment ${appointmentId}`, error as Error);
    }
  }

  private async findOrThrow(appointmentId: string) {
    const appointment = await this.prisma.blood_donation_appointments.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  private async getHospitalsById(hospitalIds: (string | null)[]) {
    const uniqueIds = [...new Set(hospitalIds.filter((id): id is string => !!id))];
    if (uniqueIds.length === 0) {
      return new Map<string, hospitals>();
    }
    const rows = await this.prisma.hospitals.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getCampaignsById(campaignIds: (string | null)[]) {
    const uniqueIds = [...new Set(campaignIds.filter((id): id is string => !!id))];
    if (uniqueIds.length === 0) {
      return new Map<string, blood_campaigns>();
    }
    const rows = await this.prisma.blood_campaigns.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async getDonorsById(donorIds: string[]) {
    const uniqueIds = [...new Set(donorIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, users>();
    }
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toPublic(
    appointment: blood_donation_appointments,
    relations?: { hospital?: hospitals; campaign?: blood_campaigns },
    donor?: users,
  ) {
    return {
      id: appointment.id,
      donorId: appointment.donor_id,
      donor: donor ? { id: donor.id, fullName: donor.full_name, email: donor.email, mobile: donor.mobile } : null,
      hospitalId: appointment.hospital_id,
      hospital: relations?.hospital ? { id: relations.hospital.id, name: relations.hospital.name } : null,
      campaignId: appointment.campaign_id,
      campaign: relations?.campaign ? { id: relations.campaign.id, name: relations.campaign.name } : null,
      bloodGroup: appointment.blood_group,
      appointmentDate: appointment.appointment_date,
      timeSlot: appointment.time_slot,
      status: appointment.status,
      notes: appointment.notes,
      cancelReason: appointment.cancel_reason,
      donationId: appointment.donation_id,
      forSelf: appointment.for_self,
      beneficiary: appointment.for_self
        ? null
        : {
            name: appointment.beneficiary_name,
            mobile: appointment.beneficiary_mobile,
            relation: appointment.beneficiary_relation,
          },
      createdAt: appointment.created_at,
      updatedAt: appointment.updated_at,
    };
  }
}
