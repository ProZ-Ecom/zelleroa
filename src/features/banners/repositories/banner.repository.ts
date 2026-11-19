import crypto from "crypto";
import { db } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma";
import type {
  CreateBannerInput,
  UpdateBannerInput,
  BannerListQueryInput,
  CustomerBannerQueryInput,
} from "../validations/banner.schema";
import type {
  BannerDto,
  BannerListResponse,
  CustomerBannerDto,
} from "../types/banner.types";

export const bannerIncludePosition = Prisma.validator<Prisma.BannerInclude>()({
  banner_positions: {
    select: {
      id: true,
      uuid: true,
      name: true,
      slug: true,
      page: true,
      is_active: true,
    },
  },
  offer: { select: { id: true, uuid: true } },
});

export function formatBanner(
  record: any
): BannerDto {
  const position = record.banner_positions || {};
  return {
    id: record.uuid || String(record.id),
    title: record.title,
    mediaType: record.media_type,
    imageUrl: record.image_url,
    videoUrl: record.video_url,
    thumbnailUrl: record.thumbnail_url,
    linkUrl: record.link_url,
    offerId: record.offer?.uuid ?? null,
    badgeLabel: record.badge_label,
    subtitle: record.subtitle,
    priceText: record.price_text,
    sortOrder: record.sortOrder,
    isActive: Boolean(record.isActive),
    startsAt: record.startsAt,
    endsAt: record.ends_at,
    bannerPosition: {
      id: position.uuid || String(position.id || ""),
      name: position.name || "",
      slug: position.slug || "",
      page: position.page || null,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function formatCustomerBanner(
  record: Prisma.BannerGetPayload<{ include: typeof bannerIncludePosition }>
): CustomerBannerDto {
  const position = record.banner_positions;
  return {
    id: record.uuid || String(record.id),
    title: record.title,
    mediaType: record.media_type,
    imageUrl: record.image_url,
    videoUrl: record.video_url,
    thumbnailUrl: record.thumbnail_url,
    // A linked offer wins over any hand-typed URL.
    linkUrl: record.offer?.uuid ? `/offers/${record.offer.uuid}` : record.link_url,
    offerId: record.offer?.uuid ?? null,
    badgeLabel: record.badge_label,
    subtitle: record.subtitle,
    priceText: record.price_text,
    sortOrder: record.sortOrder,
    bannerPosition: {
      id: position.uuid || String(position.id),
      name: position.name,
      slug: position.slug,
      page: position.page,
    },
  };
}

export const bannerRepository = {
  async findByUuid(uuid: string) {
    return db.banner.findFirst({
      where: { uuid },
      include: bannerIncludePosition,
    });
  },

  async findById(id: bigint) {
    return db.banner.findUnique({
      where: { id },
      include: bannerIncludePosition,
    });
  },

  async create(
    data: CreateBannerInput & {
      positionInternalId: bigint;
      offerInternalId?: bigint | null;
    },
    userInternalId?: bigint
  ): Promise<BannerDto> {
    const created = await db.banner.create({
      data: {
        uuid: crypto.randomUUID(),
        banner_position_id: data.positionInternalId,
        title: data.title ? data.title.trim() : null,
        media_type: data.mediaType ?? "image",
        image_url: data.imageUrl?.trim() ?? "",
        video_url: data.videoUrl ? data.videoUrl.trim() : null,
        thumbnail_url: data.thumbnailUrl ? data.thumbnailUrl.trim() : null,
        link_url: data.offerId ? null : data.linkUrl ? data.linkUrl.trim() : null,
        offer_id: data.offerInternalId ?? null,
        badge_label: data.badgeLabel ? data.badgeLabel.trim() : null,
        subtitle: data.subtitle ? data.subtitle.trim() : null,
        price_text: data.priceText ? data.priceText.trim() : null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
        startsAt: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        created_by: userInternalId ?? null,
        updated_by: userInternalId ?? null,
      },
      include: bannerIncludePosition,
    });

    return formatBanner(created);
  },

  async update(
    id: bigint,
    data: UpdateBannerInput & {
      positionInternalId?: bigint;
      offerInternalId?: bigint | null;
    },
    userInternalId?: bigint
  ): Promise<BannerDto> {
    const updateData: Prisma.BannerUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.positionInternalId !== undefined) {
      updateData.banner_positions = {
        connect: { id: data.positionInternalId },
      };
    }

    if (data.title !== undefined) {
      updateData.title = data.title ? data.title.trim() : null;
    }

    if (data.mediaType !== undefined) {
      updateData.media_type = data.mediaType;
    }

    if (data.imageUrl !== undefined) {
      updateData.image_url = data.imageUrl.trim();
    }

    if (data.videoUrl !== undefined) {
      updateData.video_url = data.videoUrl ? data.videoUrl.trim() : null;
    }

    if (data.thumbnailUrl !== undefined) {
      updateData.thumbnail_url = data.thumbnailUrl
        ? data.thumbnailUrl.trim()
        : null;
    }

    if (data.linkUrl !== undefined) {
      updateData.link_url = data.linkUrl ? data.linkUrl.trim() : null;
    }

    if (data.offerId !== undefined) {
      if (data.offerInternalId) {
        updateData.offer = { connect: { id: data.offerInternalId } };
        updateData.link_url = null;
      } else {
        updateData.offer = { disconnect: true };
      }
    }

    if (data.badgeLabel !== undefined) {
      updateData.badge_label = data.badgeLabel ? data.badgeLabel.trim() : null;
    }

    if (data.subtitle !== undefined) {
      updateData.subtitle = data.subtitle ? data.subtitle.trim() : null;
    }

    if (data.priceText !== undefined) {
      updateData.price_text = data.priceText ? data.priceText.trim() : null;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.startsAt !== undefined) {
      updateData.startsAt = data.startsAt;
    }

    if (data.endsAt !== undefined) {
      updateData.ends_at = data.endsAt;
    }

    if (userInternalId) {
      updateData.users_banners_updated_byTousers = {
        connect: { id: userInternalId },
      };
    }

    const updated = await db.banner.update({
      where: { id },
      data: updateData,
      include: bannerIncludePosition,
    });

    return formatBanner(updated);
  },

  async findAll(
    params: BannerListQueryInput,
    resolvedPositionId?: bigint
  ): Promise<BannerListResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.BannerWhereInput = {};

    if (resolvedPositionId !== undefined) {
      where.banner_position_id = resolvedPositionId;
    } else if (params.positionSlug) {
      where.banner_positions = {
        slug: params.positionSlug.trim().toLowerCase(),
      };
    }

    if (params.isActive !== undefined && params.isActive !== null) {
      where.isActive = Boolean(params.isActive);
    }

    if (params.search) {
      const search = params.search.trim();
      where.OR = [
        { title: { contains: search } },
        { link_url: { contains: search } },
        { image_url: { contains: search } },
        {
          banner_positions: {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { page: { contains: search } },
            ],
          },
        },
      ];
    }

    const sortField = params.sortBy ?? "createdAt";
    const sortDirection = params.sortOrder ?? "desc";

    let orderBy: Prisma.BannerOrderByWithRelationInput = {
      createdAt: sortDirection,
    };

    if (sortField === "title") {
      orderBy = { title: sortDirection };
    } else if (sortField === "sortOrder") {
      orderBy = { sortOrder: sortDirection };
    } else if (sortField === "startsAt") {
      orderBy = { startsAt: sortDirection };
    } else if (sortField === "endsAt") {
      orderBy = { ends_at: sortDirection };
    } else if (sortField === "updatedAt") {
      orderBy = { updatedAt: sortDirection };
    }

    const [records, total] = await Promise.all([
      db.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: bannerIncludePosition,
      }),
      db.banner.count({ where }),
    ]);

    return {
      data: records.map(formatBanner),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async findActiveCustomerBanners(
    params: CustomerBannerQueryInput,
    now: Date = new Date()
  ): Promise<CustomerBannerDto[]> {
    const where: Prisma.BannerWhereInput = {
      isActive: true,
      banner_positions: {
        is_active: true,
      },
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ ends_at: null }, { ends_at: { gte: now } }],
        },
        // A banner tied to an offer disappears once that offer stops running.
        {
          OR: [
            { offer_id: null },
            {
              offer: {
                isActive: true,
                deleted_at: null,
                AND: [
                  { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                  { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
                ],
              },
            },
          ],
        },
      ],
    };

    if (params.position) {
      where.banner_positions = {
        is_active: true,
        slug: params.position.trim().toLowerCase(),
      };
    } else if (params.page) {
      where.banner_positions = {
        is_active: true,
        page: params.page.trim().toLowerCase(),
      };
    }

    const records = await db.banner.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: bannerIncludePosition,
    });

    return records.map(formatCustomerBanner);
  },

  async delete(id: bigint): Promise<void> {
    await db.banner.delete({
      where: { id },
    });
  },
};

