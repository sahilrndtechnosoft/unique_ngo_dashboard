import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { blood_group, donation_status, Prisma } from '../../../generated/prisma/client';
import { normalizeMobile } from '../../common/utils/crypto.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDonationSheetRecordDto,
  ImportDonationSheetDto,
  ListDonationSheetRecordsQueryDto,
  MatchDonationSheetRecordDto,
  UpdateDonationSheetRecordDto,
} from '../dto/sheet-import.dto';

const COLUMN_ALIASES: Record<string, string[]> = {
  donorName: ['donor_name', 'donorname', 'name', 'donor'],
  donorMobile: ['donor_mobile', 'mobile', 'phone', 'contact', 'contact_number'],
  donorEmail: ['donor_email', 'email'],
  bloodGroup: ['blood_group', 'bloodgroup', 'group'],
  units: ['units', 'units_donated', 'quantity'],
  donationDate: ['donation_date', 'date'],
};

type SheetRecordRow = {
  id: string;
  hospital_id: string | null;
  campaign_id: string | null;
  donor_name: string | null;
  donor_mobile: string | null;
  donor_email: string | null;
  blood_group: string | null;
  units: Prisma.Decimal | null;
  donation_date: Date | null;
  raw_row: Prisma.JsonValue;
  matched_donation_id: string | null;
  imported_by_id: string;
  created_at: Date;
};

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new BadRequestException('Sheet must contain a header row and at least one data row');
  }

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

function pickColumn(row: Record<string, string>, field: keyof typeof COLUMN_ALIASES): string | undefined {
  for (const alias of COLUMN_ALIASES[field]) {
    if (row[alias]) {
      return row[alias];
    }
  }
  return undefined;
}

function parseBloodGroup(value: string | null): blood_group | undefined {
  if (!value) return undefined;

  const raw = value.trim().toUpperCase();
  // Accepts common spreadsheet formats: "O+", "AB-", "A POS", "A_POSITIVE"
  const shorthand = raw.match(/^(A|B|AB|O)\s*([+-])$/);
  const normalized = shorthand
    ? `${shorthand[1]}_${shorthand[2] === '+' ? 'POSITIVE' : 'NEGATIVE'}`
    : raw.replace(/\s+/g, '_').replace(/_POS$/, '_POSITIVE').replace(/_NEG$/, '_NEGATIVE');

  return (Object.values(blood_group) as string[]).includes(normalized) ? (normalized as blood_group) : undefined;
}

@Injectable()
export class SheetImportService {
  constructor(private readonly prisma: PrismaService) {}

  async importSheet(fileBuffer: Buffer, dto: ImportDonationSheetDto, importedById: string) {
    if (!dto.hospitalId && !dto.campaignId) {
      throw new BadRequestException('Either hospitalId or campaignId is required');
    }

    const rows = parseCsv(fileBuffer.toString('utf-8'));

    let autoMatched = 0;
    for (const row of rows) {
      const record = await this.prisma.donation_sheet_records.create({
        data: {
          hospital_id: dto.hospitalId,
          campaign_id: dto.campaignId,
          donor_name: pickColumn(row, 'donorName'),
          donor_mobile: pickColumn(row, 'donorMobile'),
          donor_email: pickColumn(row, 'donorEmail'),
          blood_group: pickColumn(row, 'bloodGroup'),
          units: pickColumn(row, 'units') ? Number(pickColumn(row, 'units')) : undefined,
          donation_date: pickColumn(row, 'donationDate') ? new Date(pickColumn(row, 'donationDate')!) : undefined,
          raw_row: row as Prisma.InputJsonValue,
          imported_by_id: importedById,
        },
      });

      if (await this.tryAutoMatch(record)) {
        autoMatched += 1;
      }
    }

    return { imported: rows.length, autoMatched, unmatched: rows.length - autoMatched };
  }

  async createRecord(dto: CreateDonationSheetRecordDto, importedById: string) {
    if (!dto.hospitalId && !dto.campaignId) {
      throw new BadRequestException('Either hospitalId or campaignId is required');
    }

    const record = await this.prisma.donation_sheet_records.create({
      data: {
        hospital_id: dto.hospitalId,
        campaign_id: dto.campaignId,
        donor_name: dto.donorName,
        donor_mobile: dto.donorMobile,
        donor_email: dto.donorEmail,
        blood_group: dto.bloodGroup,
        units: dto.units,
        donation_date: dto.donationDate ? new Date(dto.donationDate) : undefined,
        raw_row: { source: 'manual' } as Prisma.InputJsonValue,
        imported_by_id: importedById,
      },
    });

    await this.tryAutoMatch(record);
    return this.toPublic(await this.findOrThrow(record.id));
  }

  async listRecords(query: ListDonationSheetRecordsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.donation_sheet_recordsWhereInput = {
      ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
      ...(query.campaignId ? { campaign_id: query.campaignId } : {}),
      ...(query.unmatchedOnly ? { matched_donation_id: null } : {}),
      ...(query.search
        ? {
            OR: [
              { donor_name: { contains: query.search, mode: 'insensitive' } },
              { donor_mobile: { contains: query.search, mode: 'insensitive' } },
              { donor_email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.donation_sheet_records.count({ where }),
      this.prisma.donation_sheet_records.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
    ]);

    return {
      items: rows.map((row) => this.toPublic(row)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getRecord(recordId: string) {
    return this.toPublic(await this.findOrThrow(recordId));
  }

  async updateRecord(recordId: string, dto: UpdateDonationSheetRecordDto) {
    await this.findOrThrow(recordId);

    if (dto.matchedDonationId) {
      const donation = await this.prisma.blood_donations.findFirst({
        where: { id: dto.matchedDonationId, deleted_at: null },
      });
      if (!donation) {
        throw new NotFoundException('Donation not found');
      }
    }

    const updated = await this.prisma.donation_sheet_records.update({
      where: { id: recordId },
      data: {
        ...(dto.hospitalId !== undefined && { hospital_id: dto.hospitalId }),
        ...(dto.campaignId !== undefined && { campaign_id: dto.campaignId }),
        ...(dto.donorName !== undefined && { donor_name: dto.donorName }),
        ...(dto.donorMobile !== undefined && { donor_mobile: dto.donorMobile }),
        ...(dto.donorEmail !== undefined && { donor_email: dto.donorEmail }),
        ...(dto.bloodGroup !== undefined && { blood_group: dto.bloodGroup }),
        ...(dto.units !== undefined && { units: dto.units }),
        ...(dto.donationDate !== undefined && { donation_date: new Date(dto.donationDate) }),
        ...(dto.matchedDonationId !== undefined && { matched_donation_id: dto.matchedDonationId }),
      },
    });

    return this.toPublic(updated);
  }

  async deleteRecord(recordId: string) {
    await this.findOrThrow(recordId);
    await this.prisma.donation_sheet_records.delete({ where: { id: recordId } });
  }

  async matchRecord(recordId: string, dto: MatchDonationSheetRecordDto) {
    await this.findOrThrow(recordId);

    const donation = await this.prisma.blood_donations.findFirst({
      where: { id: dto.donationId, deleted_at: null },
    });
    if (!donation) {
      throw new NotFoundException('Donation not found');
    }

    const updated = await this.prisma.donation_sheet_records.update({
      where: { id: recordId },
      data: { matched_donation_id: dto.donationId },
    });

    return this.toPublic(updated);
  }

  /** Candidate blood_donations that genuinely look like the same donation this sheet row describes. */
  async getCandidates(recordId: string) {
    const record = await this.findOrThrow(recordId);
    const donations = await this.findCandidateDonations(record);
    const donorsById = new Map(
      (
        await this.prisma.users.findMany({ where: { id: { in: donations.map((d) => d.donor_id) } } })
      ).map((donor) => [donor.id, donor]),
    );

    return donations.map((donation) => ({
      id: donation.id,
      donorId: donation.donor_id,
      donor: donorsById.get(donation.donor_id)
        ? {
            id: donorsById.get(donation.donor_id)!.id,
            fullName: donorsById.get(donation.donor_id)!.full_name,
            mobile: donorsById.get(donation.donor_id)!.mobile,
            email: donorsById.get(donation.donor_id)!.email,
          }
        : null,
      bloodGroup: donation.blood_group,
      donationDate: donation.donation_date,
      status: donation.status,
      unitsDonated: Number(donation.units_donated),
    }));
  }

  /** Auto-links this row to its blood_donations record when exactly one genuine match is found. Returns whether it matched. */
  private async tryAutoMatch(record: SheetRecordRow): Promise<boolean> {
    const candidates = await this.findCandidateDonations(record);
    if (candidates.length !== 1) {
      return false;
    }

    await this.prisma.donation_sheet_records.update({
      where: { id: record.id },
      data: { matched_donation_id: candidates[0].id },
    });
    return true;
  }

  private async findCandidateDonations(record: SheetRecordRow) {
    if (!record.donor_mobile && !record.donor_email) {
      return [];
    }

    const donor = await this.prisma.users.findFirst({
      where: {
        deleted_at: null,
        OR: [
          ...(record.donor_mobile ? [{ mobile: normalizeMobile(record.donor_mobile) }] : []),
          ...(record.donor_email ? [{ email: record.donor_email.toLowerCase() }] : []),
        ],
      },
    });
    if (!donor) {
      return [];
    }

    const bloodGroup = parseBloodGroup(record.blood_group);

    return this.prisma.blood_donations.findMany({
      where: {
        donor_id: donor.id,
        deleted_at: null,
        status: { in: [donation_status.PENDING, donation_status.UNDER_REVIEW] },
        ...(bloodGroup ? { blood_group: bloodGroup } : {}),
        ...(record.donation_date ? { donation_date: record.donation_date } : {}),
        ...(record.hospital_id ? { hospital_id: record.hospital_id } : {}),
        ...(record.campaign_id ? { campaign_id: record.campaign_id } : {}),
      },
    });
  }

  private async findOrThrow(recordId: string) {
    const record = await this.prisma.donation_sheet_records.findUnique({ where: { id: recordId } });
    if (!record) {
      throw new NotFoundException('Sheet record not found');
    }
    return record;
  }

  private toPublic(record: SheetRecordRow) {
    return {
      id: record.id,
      hospitalId: record.hospital_id,
      campaignId: record.campaign_id,
      donorName: record.donor_name,
      donorMobile: record.donor_mobile,
      donorEmail: record.donor_email,
      bloodGroup: record.blood_group,
      units: record.units ? Number(record.units) : null,
      donationDate: record.donation_date,
      rawRow: record.raw_row,
      matchedDonationId: record.matched_donation_id,
      importedById: record.imported_by_id,
      createdAt: record.created_at,
    };
  }
}
