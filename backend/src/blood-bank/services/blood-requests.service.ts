import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { blood_request_status, blood_requests, Prisma, users } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminCreateBloodRequestDto,
  AdminUpdateBloodRequestDto,
  CreateBloodRequestDto,
  ListBloodRequestsQueryDto,
} from '../dto/blood-request.dto';

@Injectable()
export class BloodRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(requesterId: string, dto: CreateBloodRequestDto) {
    const request = await this.prisma.blood_requests.create({
      data: {
        requester_id: requesterId,
        patient_name: dto.patientName,
        blood_group: dto.bloodGroup,
        units_required: dto.unitsRequired ?? 1,
        urgency: dto.urgency ?? 'MEDIUM',
        hospital_name: dto.hospitalName,
        hospital_address: dto.hospitalAddress,
        city: dto.city,
        state: dto.state,
        contact_name: dto.contactName,
        contact_mobile: dto.contactMobile,
        required_by_date: new Date(dto.requiredByDate),
        notes: dto.notes,
        is_emergency: dto.isEmergency ?? false,
      },
    });

    return this.toPublic(request);
  }

  async adminCreateRequest(dto: AdminCreateBloodRequestDto) {
    const requester = await this.prisma.users.findFirst({ where: { id: dto.userId, deleted_at: null } });
    if (!requester) {
      throw new NotFoundException('User not found');
    }

    return this.createRequest(dto.userId, dto);
  }

  async listMyRequests(requesterId: string, query: ListBloodRequestsQueryDto) {
    return this.listRequests(query, { requesterId });
  }

  async getMyRequest(requesterId: string, requestId: string) {
    return this.toPublic(await this.findOrThrow(requestId, { requesterId }));
  }

  async cancelRequest(requesterId: string, requestId: string) {
    const request = await this.findOrThrow(requestId, { requesterId });
    if (request.status !== blood_request_status.OPEN && request.status !== blood_request_status.PARTIALLY_FULFILLED) {
      throw new BadRequestException('Only open requests can be cancelled');
    }

    const updated = await this.prisma.blood_requests.update({
      where: { id: requestId },
      data: { status: blood_request_status.CANCELLED, updated_at: new Date() },
    });

    return this.toPublic(updated);
  }

  async listRequests(query: ListBloodRequestsQueryDto, options?: { requesterId?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.blood_requestsWhereInput = {
      deleted_at: null,
      ...(options?.requesterId ? { requester_id: options.requesterId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.bloodGroup ? { blood_group: query.bloodGroup } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.isEmergency !== undefined ? { is_emergency: query.isEmergency } : {}),
      ...(query.search
        ? {
            OR: [
              { patient_name: { contains: query.search, mode: 'insensitive' } },
              { hospital_name: { contains: query.search, mode: 'insensitive' } },
              { contact_mobile: { contains: query.search, mode: 'insensitive' } },
              { contact_name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.blood_requests.count({ where }),
      this.prisma.blood_requests.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    const requestersById = await this.getRequestersById(rows.map((row) => row.requester_id));

    return {
      items: rows.map((row) => this.toPublic(row, requestersById.get(row.requester_id))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getRequest(requestId: string) {
    const request = await this.findOrThrow(requestId);
    const requester = await this.prisma.users.findUnique({ where: { id: request.requester_id } });
    return this.toPublic(request, requester ?? undefined);
  }

  async adminUpdateRequest(requestId: string, dto: AdminUpdateBloodRequestDto, adminId: string) {
    const request = await this.findOrThrow(requestId);

    const updated = await this.prisma.blood_requests.update({
      where: { id: requestId },
      data: {
        ...(dto.patientName !== undefined && { patient_name: dto.patientName }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.unitsRequired !== undefined && { units_required: dto.unitsRequired }),
        ...(dto.unitsFulfilled !== undefined && { units_fulfilled: dto.unitsFulfilled }),
        ...(dto.urgency !== undefined && { urgency: dto.urgency }),
        ...(dto.hospitalName !== undefined && { hospital_name: dto.hospitalName }),
        ...(dto.hospitalAddress !== undefined && { hospital_address: dto.hospitalAddress }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.contactName !== undefined && { contact_name: dto.contactName }),
        ...(dto.contactMobile !== undefined && { contact_mobile: dto.contactMobile }),
        ...(dto.requiredByDate !== undefined && { required_by_date: new Date(dto.requiredByDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isEmergency !== undefined && { is_emergency: dto.isEmergency }),
        ...(dto.adminNote !== undefined && { admin_note: dto.adminNote }),
        ...(dto.expiresAt !== undefined && { expires_at: new Date(dto.expiresAt) }),
        ...(dto.status !== undefined && { status: dto.status, verified_by_id: request.verified_by_id ?? adminId }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async adminDeleteRequest(requestId: string) {
    await this.findOrThrow(requestId);
    await this.prisma.blood_requests.update({
      where: { id: requestId },
      data: { deleted_at: new Date() },
    });
  }

  private async findOrThrow(requestId: string, options?: { requesterId?: string }) {
    const request = await this.prisma.blood_requests.findFirst({
      where: { id: requestId, deleted_at: null, ...(options?.requesterId ? { requester_id: options.requesterId } : {}) },
    });
    if (!request) {
      throw new NotFoundException('Blood request not found');
    }
    return request;
  }

  private async getRequestersById(requesterIds: string[]) {
    const uniqueIds = [...new Set(requesterIds)];
    if (uniqueIds.length === 0) {
      return new Map<string, users>();
    }
    const rows = await this.prisma.users.findMany({ where: { id: { in: uniqueIds } } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toPublic(request: blood_requests, requester?: users) {
    return {
      id: request.id,
      requesterId: request.requester_id,
      requester: requester
        ? { id: requester.id, fullName: requester.full_name, email: requester.email, mobile: requester.mobile }
        : null,
      patientName: request.patient_name,
      bloodGroup: request.blood_group,
      unitsRequired: Number(request.units_required),
      unitsFulfilled: Number(request.units_fulfilled),
      urgency: request.urgency,
      hospitalName: request.hospital_name,
      hospitalAddress: request.hospital_address,
      city: request.city,
      state: request.state,
      contactName: request.contact_name,
      contactMobile: request.contact_mobile,
      requiredByDate: request.required_by_date,
      status: request.status,
      notes: request.notes,
      isEmergency: request.is_emergency,
      adminNote: request.admin_note,
      verifiedById: request.verified_by_id,
      expiresAt: request.expires_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    };
  }
}
