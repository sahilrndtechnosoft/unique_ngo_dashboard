import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, reward_activity, reward_rules } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRewardRuleDto,
  ListRewardRulesQueryDto,
  UpdateRewardRuleDto,
} from '../dto/reward.dto';

@Injectable()
export class RewardRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules(query: ListRewardRulesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.reward_rulesWhereInput = {
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.reward_rules.count({ where }),
      this.prisma.reward_rules.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
      }),
    ]);

    return {
      items: rows.map((r) => this.toPublic(r)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getRuleById(id: string) {
    return this.toPublic(await this.findOrThrow(id));
  }

  async getRuleByActivity(activity: reward_activity) {
    const rule = await this.prisma.reward_rules.findUnique({
      where: { activity },
    });
    return rule ? this.toPublic(rule) : null;
  }

  async createRule(dto: CreateRewardRuleDto, createdById: string) {
    const existing = await this.prisma.reward_rules.findUnique({
      where: { activity: dto.activity },
    });
    if (existing) {
      throw new ConflictException(`A rule for activity "${dto.activity}" already exists`);
    }

    if (dto.validFrom && dto.validUntil && new Date(dto.validFrom) > new Date(dto.validUntil)) {
      throw new BadRequestException('validFrom cannot be after validUntil');
    }

    const rule = await this.prisma.reward_rules.create({
      data: {
        activity: dto.activity,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        points: dto.points,
        multiplier: dto.multiplier ?? 1.0,
        max_per_day: dto.maxPerDay,
        max_per_month: dto.maxPerMonth,
        max_lifetime: dto.maxLifetime,
        requires_proof: dto.requiresProof ?? false,
        requires_admin_approval: dto.requiresAdminApproval ?? false,
        is_active: dto.isActive ?? true,
        valid_from: dto.validFrom ? new Date(dto.validFrom) : null,
        valid_until: dto.validUntil ? new Date(dto.validUntil) : null,
        conditions: (dto.conditions as Prisma.InputJsonValue) ?? undefined,
        created_by_id: createdById,
      },
    });

    return this.toPublic(rule);
  }

  async updateRule(id: string, dto: UpdateRewardRuleDto) {
    const existing = await this.findOrThrow(id);

    const validFrom = dto.validFrom ?? existing.valid_from?.toISOString();
    const validUntil = dto.validUntil ?? existing.valid_until?.toISOString();
    if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) {
      throw new BadRequestException('validFrom cannot be after validUntil');
    }

    const updated = await this.prisma.reward_rules.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.points !== undefined && { points: dto.points }),
        ...(dto.multiplier !== undefined && { multiplier: dto.multiplier }),
        ...(dto.maxPerDay !== undefined && { max_per_day: dto.maxPerDay }),
        ...(dto.maxPerMonth !== undefined && { max_per_month: dto.maxPerMonth }),
        ...(dto.maxLifetime !== undefined && { max_lifetime: dto.maxLifetime }),
        ...(dto.requiresProof !== undefined && { requires_proof: dto.requiresProof }),
        ...(dto.requiresAdminApproval !== undefined && { requires_admin_approval: dto.requiresAdminApproval }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        ...(dto.validFrom !== undefined && { valid_from: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { valid_until: dto.validUntil ? new Date(dto.validUntil) : null }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions as Prisma.InputJsonValue }),
        updated_at: new Date(),
      },
    });

    return this.toPublic(updated);
  }

  async deleteRule(id: string) {
    await this.findOrThrow(id);
    await this.prisma.reward_rules.delete({ where: { id } });
  }

  private async findOrThrow(id: string): Promise<reward_rules> {
    const rule = await this.prisma.reward_rules.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Reward rule not found');
    }
    return rule;
  }

  private toPublic(rule: reward_rules) {
    return {
      id: rule.id,
      activity: rule.activity,
      name: rule.name,
      description: rule.description,
      points: rule.points,
      multiplier: Number(rule.multiplier),
      maxPerDay: rule.max_per_day,
      maxPerMonth: rule.max_per_month,
      maxLifetime: rule.max_lifetime,
      requiresProof: rule.requires_proof,
      requiresAdminApproval: rule.requires_admin_approval,
      isActive: rule.is_active,
      validFrom: rule.valid_from,
      validUntil: rule.valid_until,
      conditions: rule.conditions,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    };
  }
}
