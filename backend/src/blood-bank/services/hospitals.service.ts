import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hospitals, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHospitalDto, ListHospitalsQueryDto, UpdateHospitalDto } from '../dto/hospital.dto';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  async listHospitals(query: ListHospitalsQueryDto, activeOnly = false) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.hospitalsWhereInput = {
      deleted_at: null,
      ...(activeOnly || query.isActive === true ? { is_active: true } : {}),
      ...(query.isActive === false ? { is_active: false } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
              { registration_no: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.hospitals.count({ where }),
      this.prisma.hospitals.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getHospital(hospitalId: string) {
    return this.toPublic(await this.findOrThrow(hospitalId));
  }

  async createHospital(dto: CreateHospitalDto, createdById: string) {
    const hospital = await this.prisma.hospitals.create({
      data: {
        name: dto.name,
        registration_no: dto.registrationNo,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        postal_code: dto.postalCode,
        contact_name: dto.contactName,
        contact_mobile: dto.contactMobile,
        contact_email: dto.contactEmail,
        latitude: dto.latitude,
        longitude: dto.longitude,
        sheet_url: dto.sheetUrl,
        is_active: dto.isActive ?? true,
        created_by_id: createdById,
      },
    });

    return this.toPublic(hospital);
  }

  async updateHospital(hospitalId: string, dto: UpdateHospitalDto) {
    await this.findOrThrow(hospitalId);

    const updated = await this.prisma.hospitals.update({
      where: { id: hospitalId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.registrationNo !== undefined && { registration_no: dto.registrationNo }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postal_code: dto.postalCode }),
        ...(dto.contactName !== undefined && { contact_name: dto.contactName }),
        ...(dto.contactMobile !== undefined && { contact_mobile: dto.contactMobile }),
        ...(dto.contactEmail !== undefined && { contact_email: dto.contactEmail }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.sheetUrl !== undefined && { sheet_url: dto.sheetUrl }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deleteHospital(hospitalId: string) {
    await this.findOrThrow(hospitalId);

    const [campaignCount, donationCount] = await Promise.all([
      this.prisma.blood_campaigns.count({ where: { hospital_id: hospitalId, deleted_at: null } }),
      this.prisma.blood_donations.count({ where: { hospital_id: hospitalId, deleted_at: null } }),
    ]);

    if (campaignCount > 0 || donationCount > 0) {
      throw new BadRequestException(
        'Hospital has linked campaigns or donations. Deactivate it instead of deleting.',
      );
    }

    await this.prisma.hospitals.update({
      where: { id: hospitalId },
      data: { deleted_at: new Date(), is_active: false },
    });
  }

  private async findOrThrow(hospitalId: string) {
    const hospital = await this.prisma.hospitals.findFirst({
      where: { id: hospitalId, deleted_at: null },
    });
    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }
    return hospital;
  }

  private toPublic(hospital: hospitals) {
    return {
      id: hospital.id,
      name: hospital.name,
      registrationNo: hospital.registration_no,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      postalCode: hospital.postal_code,
      contactName: hospital.contact_name,
      contactMobile: hospital.contact_mobile,
      contactEmail: hospital.contact_email,
      latitude: hospital.latitude ? Number(hospital.latitude) : null,
      longitude: hospital.longitude ? Number(hospital.longitude) : null,
      sheetUrl: hospital.sheet_url,
      isActive: hospital.is_active,
      createdAt: hospital.created_at,
      updatedAt: hospital.updated_at,
    };
  }
}
