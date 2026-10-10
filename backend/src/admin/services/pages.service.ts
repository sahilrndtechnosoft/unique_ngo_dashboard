import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { pages, page_type } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from '../dto/page.dto';

@Injectable()
export class PagesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultPages();
  }

  async listPages(activeOnly = false, type?: page_type) {
    const rows = await this.prisma.pages.findMany({
      where: {
        deleted_at: null,
        ...(activeOnly ? { is_active: true } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }, { created_at: 'desc' }],
    });

    return rows.map((row) => this.toPublic(row));
  }

  async getPage(pageId: string) {
    const page = await this.findPageOrThrow(pageId);
    return this.toPublic(page);
  }

  async getPageBySlug(slug: string) {
    const page = await this.prisma.pages.findFirst({
      where: { slug, deleted_at: null, is_active: true },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return this.toPublic(page);
  }

  async createPage(dto: CreatePageDto, updatedById?: string) {
    const slug = await this.generateUniqueSlug(dto.title);

    const page = await this.prisma.pages.create({
      data: {
        slug,
        title: dto.title,
        type: dto.type,
        content: dto.content,
        sort_order: dto.sortOrder ?? 0,
        is_active: dto.isActive ?? true,
        updated_by_id: updatedById,
      },
    });

    return this.toPublic(page);
  }

  async updatePage(pageId: string, dto: UpdatePageDto, updatedById?: string) {
    await this.findPageOrThrow(pageId);

    const updated = await this.prisma.pages.update({
      where: { id: pageId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.sortOrder !== undefined && { sort_order: dto.sortOrder }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_by_id: updatedById,
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deletePage(pageId: string) {
    await this.findPageOrThrow(pageId);

    await this.prisma.pages.update({
      where: { id: pageId },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      },
    });
  }

  private async findPageOrThrow(pageId: string): Promise<pages> {
    const page = await this.prisma.pages.findFirst({
      where: { id: pageId, deleted_at: null },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'page';

    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.pages.findFirst({ where: { slug, deleted_at: null } })
    ) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async ensureDefaultPages() {
    await this.prisma.pages.createMany({
      skipDuplicates: true,
      data: DEFAULT_PAGES,
    });
  }

  private toPublic(page: pages) {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      type: page.type,
      content: page.content,
      sortOrder: page.sort_order,
      isActive: page.is_active,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    };
  }
}

const DEFAULT_PAGES = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    type: 'PRIVACY_POLICY' as page_type,
    sort_order: 10,
    is_active: true,
    content:
      '<h2>Privacy Policy</h2><p>Unique NGO collects only the information needed to provide blood donation, emergency request, appointment, marketplace, notification, and account services.</p><p>We use this information to verify users, coordinate donors and hospitals, process requests, send important updates, prevent fraud, and improve service quality.</p><p>We do not sell personal information. Data may be shared only with authorised administrators, hospitals, service providers, or authorities where required to complete a request or comply with law.</p><p>Users may request correction, deletion, or account support by contacting the organisation through the official support channel.</p>',
  },
  {
    slug: 'return-policy',
    title: 'Return Policy',
    type: 'INFORMATION' as page_type,
    sort_order: 20,
    is_active: true,
    content:
      '<h2>Return Policy</h2><p>Returns are accepted only for eligible marketplace orders or donation-item handovers according to the item condition, delivery status, and return window shown at the time of transaction.</p><p>Items must be unused, safely packed, and returned with any available proof, images, or order details requested by the support team.</p><p>Perishable, hygiene-sensitive, personalised, damaged-by-user, or final-sale items may not be returnable unless required by law or approved by the administrator.</p>',
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    type: 'INFORMATION' as page_type,
    sort_order: 30,
    is_active: true,
    content:
      '<h2>Disclaimer</h2><p>Unique NGO helps connect users, donors, hospitals, volunteers, sellers, and beneficiaries. Information shown in the app is provided for coordination and support purposes.</p><p>Emergency, medical, blood donation, and eligibility decisions must be confirmed by qualified medical professionals or authorised institutions.</p><p>The platform may contain user-submitted details. While moderation and verification are performed where possible, users should independently verify critical information before acting on it.</p>',
  },
  {
    slug: 'refund-policy',
    title: 'Refund Policy',
    type: 'INFORMATION' as page_type,
    sort_order: 40,
    is_active: true,
    content:
      '<h2>Refund Policy</h2><p>Refunds are processed only for eligible cancelled, failed, returned, or administrator-approved transactions.</p><p>Approved prepaid refunds are returned through the original payment method wherever supported by the payment provider. Cash-on-delivery or offline cases may require manual verification and bank details.</p><p>Refund timelines depend on the payment gateway, bank, and internal review status. Duplicate, fraudulent, already-settled, or policy-ineligible claims may be rejected.</p>',
  },
  {
    slug: 'compliances',
    title: 'Compliances',
    type: 'INFORMATION' as page_type,
    sort_order: 50,
    is_active: true,
    content:
      '<h2>Compliances</h2><p>Unique NGO aims to operate according to applicable Indian laws, data-protection practices, payment rules, charitable activity requirements, and blood-donation safety guidelines.</p><p>Administrators must maintain accurate records, verify critical requests, protect sensitive personal data, and restrict access to authorised users only.</p><p>Users, hospitals, sellers, and volunteers are expected to provide truthful information and follow platform policies, medical instructions, and legal requirements.</p>',
  },
  {
    slug: 'consent-form',
    title: 'Blood Donor Consent Form',
    type: 'INFORMATION' as page_type,
    sort_order: 60,
    is_active: true,
    content:
      '<h2>Blood Donor Consent Form</h2><p>I hereby voluntarily agree and consent to donate blood. I confirm that the information provided regarding my health, medical history, recent procedures (including tattoos), and eligibility is accurate and complete to the best of my knowledge.</p><p>I understand the blood donation procedure, tests that may be carried out on the donated blood, and potential risks. I consent to my blood being screened and utilized for patients in need.</p>',
  },
];
