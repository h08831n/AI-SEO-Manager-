import { prisma } from '../db/prisma';
import { EntityType, BusinessValueTier } from '@prisma/client';

export interface CreateSeoEntityInput {
  websiteId: string;
  name: string;
  slug?: string;
  entityType?: EntityType;
  description?: string;
  targetConversionGoal?: string;
  pillarUrl?: string;
  pillarUrlIdentityId?: string;
  businessValue?: BusinessValueTier;
}

export interface UpdateSeoEntityInput {
  name?: string;
  entityType?: EntityType;
  description?: string;
  targetConversionGoal?: string;
  pillarUrl?: string;
  pillarUrlIdentityId?: string;
  businessValue?: BusinessValueTier;
}

export class SeoEntityRepository {
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static async createEntity(input: CreateSeoEntityInput) {
    const slug = input.slug || this.generateSlug(input.name);
    return await prisma.seoEntity.create({
      data: {
        websiteId: input.websiteId,
        name: input.name,
        slug,
        entityType: input.entityType || EntityType.CONCEPT,
        description: input.description,
        targetConversionGoal: input.targetConversionGoal,
        pillarUrl: input.pillarUrl,
        pillarUrlIdentityId: input.pillarUrlIdentityId,
        businessValue: input.businessValue || BusinessValueTier.TIER_2_HIGH,
      },
    });
  }

  static async getEntityById(id: string, websiteId: string) {
    const entity: any = await prisma.seoEntity.findFirst({
      where: { id, websiteId },
      include: {
        keywords: {
          select: {
            id: true,
            keyword: true,
            searchIntent: true,
            businessValue: true,
            searchVolume: true,
            currentDesktopRank: true,
          },
        },
      },
    });
    if (!entity) return null;
    if (!entity.keywords) {
      entity.keywords = await prisma.keywordUniverse.findMany({
        where: { topicEntityId: id, websiteId },
      });
    }
    return entity;
  }

  static async listEntities(websiteId: string) {
    return await prisma.seoEntity.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateEntity(id: string, websiteId: string, input: UpdateSeoEntityInput) {
    const existing = await prisma.seoEntity.findFirst({
      where: { id, websiteId },
    });
    if (!existing) {
      throw new Error(`SEO Entity '${id}' not found for website '${websiteId}'`);
    }

    return await prisma.seoEntity.update({
      where: { id },
      data: {
        ...input,
        updatedAt: new Date(),
      },
    });
  }

  static async deleteEntity(id: string, websiteId: string) {
    const existing = await prisma.seoEntity.findFirst({
      where: { id, websiteId },
    });
    if (!existing) {
      throw new Error(`SEO Entity '${id}' not found for website '${websiteId}'`);
    }

    return await prisma.seoEntity.delete({
      where: { id },
    });
  }
}
