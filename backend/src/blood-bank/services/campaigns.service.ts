import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  blood_campaigns,
  campaign_status,
  hospitals,
  Prisma,
} from '../../../generated/prisma/client';
import { deleteUploadedFile } from '../../common/utils/image-upload.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCampaignDto, ListCampaignsQueryDto, UpdateCampaignDto } from '../dto/campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(query: ListCampaignsQueryDto, activeOnly = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.blood_campaignsWhereInput = {
      deleted_at: null,
      ...(activeOnly ? { status: campaign_status.ACTIVE } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.blood_campaigns.count({ where }),
      this.prisma.blood_campaigns.findMany({ where, skip, take: limit, orderBy: { starts_at: 'desc' } }),
    ]);

    const hospitalsById = await this.getHospitalsById(rows.map((row) => row.hospital_id));

    return {
      items: rows.map((row) => this.toPublic(row, hospitalsById.get(row.hospital_id ?? ''))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getCampaign(campaignId: string) {
    const campaign = await this.findOrThrow(campaignId);
    const hospital = campaign.hospital_id
      ? await this.prisma.hospitals.findUnique({ where: { id: campaign.hospital_id } })
      : null;
    return this.toPublic(campaign, hospital ?? undefined);
  }

  async createCampaign(dto: CreateCampaignDto, createdById: string) {
    if (dto.hospitalId) {
      await this.findHospitalOrThrow(dto.hospitalId);
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const campaign = await this.prisma.blood_campaigns.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        hospital_id: dto.hospitalId,
        venue_name: dto.venueName,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        organizer_name: dto.organizerName,
        organizer_mobile: dto.organizerMobile,
        starts_at: startsAt,
        ends_at: endsAt,
        target_units: dto.targetUnits,
        sheet_url: dto.sheetUrl,
        created_by_id: createdById,
      },
    });

    return this.toPublic(campaign);
  }

  async updateCampaign(campaignId: string, dto: UpdateCampaignDto) {
    const existing = await this.findOrThrow(campaignId);

    if (dto.hospitalId) {
      await this.findHospitalOrThrow(dto.hospitalId);
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.starts_at;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.ends_at;
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const updated = await this.prisma.blood_campaigns.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.hospitalId !== undefined && { hospital_id: dto.hospitalId }),
        ...(dto.venueName !== undefined && { venue_name: dto.venueName }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.organizerName !== undefined && { organizer_name: dto.organizerName }),
        ...(dto.organizerMobile !== undefined && { organizer_mobile: dto.organizerMobile }),
        ...(dto.startsAt !== undefined && { starts_at: startsAt }),
        ...(dto.endsAt !== undefined && { ends_at: endsAt }),
        ...(dto.targetUnits !== undefined && { target_units: dto.targetUnits }),
        ...(dto.sheetUrl !== undefined && { sheet_url: dto.sheetUrl }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async updateCampaignBanner(campaignId: string, bannerPath: string) {
    const campaign = await this.findOrThrow(campaignId);
    deleteUploadedFile(campaign.banner_url);

    const updated = await this.prisma.blood_campaigns.update({
      where: { id: campaignId },
      data: { banner_url: bannerPath, updated_at: new Date() },
    });

    return this.toPublic(updated);
  }

  async deleteCampaign(campaignId: string) {
    await this.findOrThrow(campaignId);

    const appointmentCount = await this.prisma.blood_donation_appointments.count({
      where: { campaign_id: campaignId },
    });
    if (appointmentCount > 0) {
      throw new BadRequestException(
        'Campaign has booked appointments. Cancel or complete it instead of deleting.',
      );
    }

    await this.prisma.blood_campaigns.update({
      where: { id: campaignId },
      data: { deleted_at: new Date(), status: campaign_status.CANCELLED },
    });
  }

  private async findOrThrow(campaignId: string) {
    const campaign = await this.prisma.blood_campaigns.findFirst({
      where: { id: campaignId, deleted_at: null },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  private async findHospitalOrThrow(hospitalId: string) {
    const hospital = await this.prisma.hospitals.findFirst({
      where: { id: hospitalId, deleted_at: null },
    });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }
    return hospital;
  }

  private async getHospitalsById(hospitalIds: (string | null)[]) {
    const uniqueIds = [...new Set(hospitalIds.filter((id): id is string => !!id))];
    if (uniqueIds.length === 0) {
      return new Map<string, hospitals>();
    }
    const rows = await this.prisma.hospitals.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toPublic(campaign: blood_campaigns, hospital?: hospitals) {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      status: campaign.status,
      hospitalId: campaign.hospital_id,
      hospital: hospital ? { id: hospital.id, name: hospital.name } : null,
      venueName: campaign.venue_name,
      address: campaign.address,
      city: campaign.city,
      state: campaign.state,
      bannerUrl: campaign.banner_url,
      organizerName: campaign.organizer_name,
      organizerMobile: campaign.organizer_mobile,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      targetUnits: campaign.target_units,
      unitsCollected: campaign.units_collected,
      sheetUrl: campaign.sheet_url,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
    };
  }
}
