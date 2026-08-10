import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { blood_request_status, blood_requests, Prisma, users } from '../../../generated/prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminCreateBloodRequestDto,
  AdminUpdateBloodRequestDto,
  CreateBloodRequestDto,
  ListBloodRequestsQueryDto,
} from '../dto/blood-request.dto';

/** Human-readable status text used in requester-facing notifications. */
const STATUS_NOTIFICATION_TEXT: Record<blood_request_status, string> = {
  OPEN: 'is now open and visible to donors',
  PARTIALLY_FULFILLED: 'has been partially fulfilled',
  FULFILLED: 'has been fully fulfilled',
  CANCELLED: 'has been cancelled',
  EXPIRED: 'has expired',
};

@Injectable()
export class BloodRequestsService {
  private readonly logger = new Logger(BloodRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRequest(requesterId: string, dto: CreateBloodRequestDto, proofImageUrl?: string, notifyAdmins = true) {
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
        proof_image_url: proofImageUrl,
      },
    });

    await this.notifyRequester(request, 'Blood Request Submitted', `Your blood request for ${request.patient_name} (${request.blood_group.replace('_', ' ')}) has been submitted and is under review.`);

    if (notifyAdmins) {
      await this.notifyAdminsOfNewRequest(request);
    }

    return this.toPublic(request);
  }

  async adminCreateRequest(dto: AdminCreateBloodRequestDto, proofImageUrl?: string) {
    const requester = await this.prisma.users.findFirst({ where: { id: dto.userId, deleted_at: null } });
    if (!requester) {
      throw new NotFoundException('User not found');
    }

    return this.createRequest(dto.userId, dto, proofImageUrl, false);
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

    if (dto.status !== undefined && dto.status !== request.status) {
      await this.notifyRequester(
        updated,
        'Blood Request Update',
        `Your blood request for ${updated.patient_name} ${STATUS_NOTIFICATION_TEXT[dto.status]}.`,
      );
    }

    return this.toPublic(updated);
  }

  async adminDeleteRequest(requestId: string) {
    await this.findOrThrow(requestId);
    await this.prisma.blood_requests.update({
      where: { id: requestId },
      data: { deleted_at: new Date() },
    });
  }

  /** Best-effort push notification — a delivery failure must not fail the underlying request mutation. */
  private async notifyRequester(request: blood_requests, title: string, body: string) {
    try {
      await this.notificationsService.notifyUser(request.requester_id, {
        type: 'BLOOD_REQUEST',
        title,
        body,
        data: { requestId: request.id, screen: 'BLOOD_REQUEST_DETAIL' },
      });
    } catch (error) {
      this.logger.error(`Failed to notify requester ${request.requester_id} for blood request ${request.id}`, error as Error);
    }
  }

  /** Best-effort admin email — a delivery failure must not fail the underlying request mutation. */
  private async notifyAdminsOfNewRequest(request: blood_requests) {
    try {
      await this.notificationsService.notifyAdminsByEmail(
        `New Blood Request: ${request.patient_name} (${request.blood_group.replace('_', ' ')})${request.is_emergency ? ' — EMERGENCY' : ''}`,
        `<p>A new blood request has been submitted.</p>
         <ul>
           <li><strong>Patient:</strong> ${request.patient_name}</li>
           <li><strong>Blood Group:</strong> ${request.blood_group.replace('_', ' ')}</li>
           <li><strong>Units Required:</strong> ${request.units_required}</li>
           <li><strong>Urgency:</strong> ${request.urgency}${request.is_emergency ? ' (EMERGENCY)' : ''}</li>
           <li><strong>Hospital:</strong> ${request.hospital_name}, ${request.city}, ${request.state}</li>
           <li><strong>Contact:</strong> ${request.contact_name} (${request.contact_mobile})</li>
           <li><strong>Required By:</strong> ${request.required_by_date.toISOString().slice(0, 10)}</li>
         </ul>
         <p>Please review it in the admin panel.</p>`,
      );
    } catch (error) {
      this.logger.error(`Failed to email admins about blood request ${request.id}`, error as Error);
    }
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
      proofImageUrl: request.proof_image_url,
      adminNote: request.admin_note,
      verifiedById: request.verified_by_id,
      expiresAt: request.expires_at,
      createdAt: request.created_at,
      updatedAt: request.updated_at,
    };
  }
}
