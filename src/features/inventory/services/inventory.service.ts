import { db } from "@/lib/db/prisma";
import { ApiError } from "@/lib/api/api-error";
import { inventoryRepository } from "../repositories/inventory.repository";
import { recordStockMovement } from "./stock-ledger.service";
import type {
  GetInventoryParams,
  InventoryListItem,
  AdjustStockInput,
  CreateInventoryInput,
  InventoryTransactionItem,
} from "../types";

function mapToInventoryListItem(
  item: any,
  stockSums?: { stockIn: number; stockOut: number }
): InventoryListItem {
  const v = item.variant_unit_price?.variant;
  const prod = v?.item?.style?.product;
  const unit = item.variant_unit_price?.product_units;
  const available = Number(item.quantity_available ?? 0);
  const reserved = Number(item.quantity_reserved ?? 0);

  return {
    id: Number(item.id),
    productId: prod?.id ? Number(prod.id) : 0,
    variantId: v?.id ? Number(v.id) : null,
    quantity: available,
    reservedQuantity: reserved,
    reorderLevel: Number(item.reorderLevel ?? 0),
    availableQuantity: available - reserved,
    productName: prod?.name ?? "Unknown Product",
    productSlug: prod?.slug ?? "",
    variantName: v?.variant_name ?? undefined,
    colorName: v?.color_name ?? null,
    unitName: unit?.name ?? unit?.code ?? null,
    stockIn: stockSums?.stockIn ?? 0,
    stockOut: stockSums?.stockOut ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const inventoryService = {
  async getInventory(params: GetInventoryParams) {
    const { data, total } = await inventoryRepository.findAll(params);

    const variantUnitPriceIds = data
      .map((item) => item.variantUnitPriceId)
      .filter((id): id is bigint => id != null);
    const sums = await inventoryRepository.sumTransactionsByType(variantUnitPriceIds);

    const sumsByVariantUnitPriceId = new Map<string, { stockIn: number; stockOut: number }>();
    for (const row of sums) {
      const key = String(row.variant_unit_price_id);
      const entry = sumsByVariantUnitPriceId.get(key) ?? { stockIn: 0, stockOut: 0 };
      if (row.type === "in") entry.stockIn += row._sum.quantity ?? 0;
      if (row.type === "out") entry.stockOut += row._sum.quantity ?? 0;
      sumsByVariantUnitPriceId.set(key, entry);
    }

    return {
      data: data.map((item) =>
        mapToInventoryListItem(
          item,
          sumsByVariantUnitPriceId.get(String(item.variantUnitPriceId))
        )
      ),
      meta: {
        page: params.page || 1,
        limit: params.limit || 10,
        total,
        totalPages: Math.ceil(total / (params.limit || 10)),
      },
    };
  },

  async getInventoryItem(id: number) {
    const item = await inventoryRepository.findById(id);
    if (!item) {
      throw ApiError.notFound("Inventory item not found");
    }
    return mapToInventoryListItem(item);
  },

  async adjustStock(input: AdjustStockInput) {
    const inventory = await inventoryRepository.findById(input.inventoryId);
    if (!inventory) {
      throw ApiError.notFound("Inventory item not found");
    }

    if (!input.notes || input.notes.trim().length < 3) {
      throw ApiError.badRequest("A reason is required for a stock adjustment");
    }

    // Legacy endpoint: routed through the ledger so the change is fully audited.
    return db.$transaction((tx) =>
      recordStockMovement(tx, {
        variantUnitPriceId: inventory.variantUnitPriceId,
        movementType: "ADJUSTMENT",
        direction: input.quantity >= 0 ? "in" : "out",
        quantity: Math.abs(input.quantity),
        reason: input.notes,
      })
    );
  },

  async createInventory(input: CreateInventoryInput) {
    const existing = await inventoryRepository.findByVariantUnitPriceId(
      input.variantId || input.productId
    );

    if (existing) {
      throw ApiError.conflict(
        "Inventory record already exists for this unit price"
      );
    }

    const inventory = await inventoryRepository.create({
      variant_unit_price: { connect: { id: BigInt(input.variantId || input.productId) } },
      quantity_available: input.quantity,
      reorderLevel: input.reorderLevel ?? 10,
    });

    return mapToInventoryListItem(inventory);
  },

  async getLowStock() {
    const items = await db.inventory.findMany({
      where: {
        is_active: true,
        quantity_available: { gt: 0 },
      },
      include: {
        variant_unit_price: {
          include: {
            variant: {
              select: {
                id: true,
                variant_name: true,
                item: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    style: { select: { product: { select: { id: true, name: true, slug: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const lowStockItems = items.filter(
      (item) => item.quantity_available <= item.reorderLevel
    );

    return lowStockItems.map((item) => mapToInventoryListItem(item));
  },

  async getOutOfStock() {
    const items = await db.inventory.findMany({
      where: { is_active: true, quantity_available: 0 },
      include: {
        variant_unit_price: {
          include: {
            variant: {
              select: {
                id: true,
                variant_name: true,
                item: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    style: { select: { product: { select: { id: true, name: true, slug: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return items.map((item) => mapToInventoryListItem(item));
  },

  async getTransactions(
    inventoryId: number,
    params: { page?: number; limit?: number; type?: string }
  ) {
    const inventory = await inventoryRepository.findById(inventoryId);
    if (!inventory) {
      throw ApiError.notFound("Inventory item not found");
    }

    const { data, total } =
      await inventoryRepository.findTransactionsByVariantUnitPriceId(
        inventory.variantUnitPriceId,
        {
          page: params.page,
          limit: params.limit,
          type: params.type as any,
        }
      );

    const mapped: InventoryTransactionItem[] = data.map((t) => ({
      id: Number(t.id),
      inventoryId: Number(inventory.id),
      type: t.type,
      quantity: t.quantity,
      referenceType: t.referenceType,
      referenceId: t.referenceId ? Number(t.referenceId) : null,
      notes: t.note,
      createdAt: t.createdAt,
      productName: (t as any).variant_unit_price?.variant?.item?.product?.name ?? "",
    }));

    return {
      data: mapped,
      meta: {
        page: params.page || 1,
        limit: params.limit || 20,
        total,
        totalPages: Math.ceil(total / (params.limit || 20)),
      },
    };
  },
};
