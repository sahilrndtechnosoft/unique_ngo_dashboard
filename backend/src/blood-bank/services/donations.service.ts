import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  appointment_status,
  blood_donations,
  donation_status,
  hospitals,
  Prisma,
  reward_activity,
  users,
} from '../../../generated/prisma/client';
import { generateSecureToken } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminCreateDonationDto,
  AdminUpdateDonationDto,
  CreateDonationDto,
  ListDonationsQueryDto,
  UpdateDonationStatusDto,
} from '../dto/donation.dto';
import { RewardsService } from './rewards.service';

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewardsService: RewardsService,
  ) {}

  async submitDonation(donorId: string, dto: CreateDonationDto, proofImagePath: string) {
    let appointment = null;
    if (dto.appointmentId) {
      appointment = await this.prisma.blood_donation_appointments.findFirst({
        where: { id: dto.appointmentId, donor_id: donorId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }
    }

    const donation = await this.prisma.blood_donations.create({
      data: {
        donor_id: donorId,
        blood_group: dto.bloodGroup,
        donation_date: new Date(dto.donationDate),
        donation_center: dto.donationCenter,
        hospital_name: dto.hospitalName,
        hospital_id: dto.hospitalId ?? appointment?.hospital_id,
        appointment_id: dto.appointmentId,
        city: dto.city,
        state: dto.state,
        units_donated: dto.unitsDonated ?? 1,
        proof_image_url: proofImagePath,
        notes: dto.notes,
        is_camp_donation: !!(dto.campaignId ?? appointment?.campaign_id),
        campaign_id: dto.campaignId ?? appointment?.campaign_id,
      },
    });

    if (appointment) {
      await this.prisma.blood_donation_appointments.update({
        where: { id: appointment.id },
        data: { status: appointment_status.COMPLETED, donation_id: donation.id, updated_at: new Date() },
      });
    }

    return this.toPublic(donation);
  }

  async listMyDonations(donorId: string, query: ListDonationsQueryDto) {
    return this.listDonations(query, { donorId });
  }

  async getMyDonation(donorId: string, donationId: string) {
    return this.toPublic(await this.findOrThrow(donationId, { donorId }));
  }

  async listDonations(query: ListDonationsQueryDto, options?: { donorId?: string }) {
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

    const where: Prisma.blood_donationsWhereInput = {
      deleted_at: null,
      ...(options?.donorId ? { donor_id: options.donorId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
      ...(query.campaignId ? { campaign_id: query.campaignId } : {}),
      ...(query.donationDate ? { donation_date: new Date(query.donationDate) } : {}),
      ...(query.search
        ? {
            OR: [
              { hospital_name: { contains: query.search, mode: 'insensitive' } },
              { donation_center: { contains: query.search, mode: 'insensitive' } },
              { donor_id: { in: matchingDonorIds } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.blood_donations.count({ where }),
      this.prisma.blood_donations.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const donorsById = await this.getDonorsById(rows.map((row) => row.donor_id));

    return {
      items: rows.map((row) => this.toPublic(row, undefined, donorsById.get(row.donor_id))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getDonation(donationId: string) {
    const donation = await this.findOrThrow(donationId);
    const donor = await this.prisma.users.findUnique({ where: { id: donation.donor_id } });
    return this.toPublic(donation, undefined, donor ?? undefined);
  }

  async adminCreateDonation(dto: AdminCreateDonationDto, proofImagePath?: string) {
    const donor = await this.prisma.users.findFirst({ where: { id: dto.userId, deleted_at: null } });
    if (!donor) {
      throw new NotFoundException('User not found');
    }

    const donation = await this.prisma.blood_donations.create({
      data: {
        donor_id: dto.userId,
        blood_group: dto.bloodGroup,
        donation_date: new Date(dto.donationDate),
        donation_center: dto.donationCenter,
        hospital_name: dto.hospitalName,
        hospital_id: dto.hospitalId,
        appointment_id: dto.appointmentId,
        city: dto.city,
        state: dto.state,
        units_donated: dto.unitsDonated ?? 1,
        proof_image_url: proofImagePath,
        notes: dto.notes,
        is_camp_donation: !!dto.campaignId,
        campaign_id: dto.campaignId,
      },
    });

    return this.toPublic(donation, undefined, donor);
  }

  async adminUpdateDonation(donationId: string, dto: AdminUpdateDonationDto) {
    await this.findOrThrow(donationId);

    const updated = await this.prisma.blood_donations.update({
      where: { id: donationId },
      data: {
        ...(dto.hospitalId !== undefined && { hospital_id: dto.hospitalId }),
        ...(dto.campaignId !== undefined && { campaign_id: dto.campaignId, is_camp_donation: !!dto.campaignId }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.donationDate !== undefined && { donation_date: new Date(dto.donationDate) }),
        ...(dto.unitsDonated !== undefined && { units_donated: dto.unitsDonated }),
        ...(dto.donationCenter !== undefined && { donation_center: dto.donationCenter }),
        ...(dto.hospitalName !== undefined && { hospital_name: dto.hospitalName }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async adminDeleteDonation(donationId: string) {
    await this.findOrThrow(donationId);
    await this.prisma.blood_donations.update({
      where: { id: donationId },
      data: { deleted_at: new Date() },
    });
  }

  private async getDonorsById(donorIds: string[]) {
    const uniqueIds = [...new Set(donorIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, users>();
    }
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  async updateStatus(donationId: string, dto: UpdateDonationStatusDto, adminId: string) {
    const donation = await this.findOrThrow(donationId);

    if (donation.status !== donation_status.PENDING && donation.status !== donation_status.UNDER_REVIEW) {
      throw new BadRequestException('Only pending or under-review donations can be reviewed');
    }

    if (dto.status === donation_status.REJECTED) {
      const updated = await this.prisma.blood_donations.update({
        where: { id: donationId },
        data: {
          status: donation_status.REJECTED,
          rejection_reason: dto.rejectionReason,
          verified_by_id: adminId,
          verified_at: new Date(),
          updated_at: new Date(),
        },
      });
      return this.toPublic(updated);
    }

    if (dto.status !== donation_status.APPROVED) {
      const updated = await this.prisma.blood_donations.update({
        where: { id: donationId },
        data: { status: dto.status, updated_at: new Date() },
      });
      return this.toPublic(updated);
    }

    const certificateNo = `CERT-${generateSecureToken()}`;
    await this.prisma.donation_certificates.create({
      data: {
        donation_id: donationId,
        donor_id: donation.donor_id,
        certificate_no: certificateNo,
        file_url: donation.proof_image_url ?? '',
      },
    });

    const rewardResult = await this.rewardsService.creditForActivity({
      userId: donation.donor_id,
      activity: reward_activity.BLOOD_DONATION,
      referenceType: 'blood_donation',
      referenceId: donationId,
      performedById: adminId,
    });

    const updated = await this.prisma.blood_donations.update({
      where: { id: donationId },
      data: {
        status: donation_status.APPROVED,
        verified_by_id: adminId,
        verified_at: new Date(),
        certificate_url: donation.proof_image_url,
        reward_claimed: !!rewardResult,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  private async findOrThrow(donationId: string, options?: { donorId?: string }) {
    const donation = await this.prisma.blood_donations.findFirst({
      where: { id: donationId, deleted_at: null, ...(options?.donorId ? { donor_id: options.donorId } : {}) },
    });
    if (!donation) {
      throw new NotFoundException('Donation not found');
    }
    return donation;
  }

  private toPublic(donation: blood_donations, hospital?: hospitals, donor?: users) {
    return {
      id: donation.id,
      donorId: donation.donor_id,
      donor: donor ? { id: donor.id, fullName: donor.full_name, email: donor.email, mobile: donor.mobile } : null,
      bloodGroup: donation.blood_group,
      donationDate: donation.donation_date,
      donationCenter: donation.donation_center,
      hospitalName: donation.hospital_name,
      hospitalId: donation.hospital_id,
      hospital: hospital ? { id: hospital.id, name: hospital.name } : null,
      appointmentId: donation.appointment_id,
      city: donation.city,
      state: donation.state,
      unitsDonated: Number(donation.units_donated),
      status: donation.status,
      proofImageUrl: donation.proof_image_url,
      notes: donation.notes,
      verifiedById: donation.verified_by_id,
      verifiedAt: donation.verified_at,
      rejectionReason: donation.rejection_reason,
      certificateUrl: donation.certificate_url,
      isCampDonation: donation.is_camp_donation,
      campaignId: donation.campaign_id,
      rewardClaimed: donation.reward_claimed,
      createdAt: donation.created_at,
      updatedAt: donation.updated_at,
    };
  }
}
