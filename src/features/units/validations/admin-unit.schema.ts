import { z } from "zod";

export const unitTypeEnum = z.enum(["weight", "volume", "count", "size"]);
export type UnitType = z.infer<typeof unitTypeEnum>;

export const unitHierarchyEnum = z.enum(["base", "derived"]);
export type UnitHierarchy = z.infer<typeof unitHierarchyEnum>;

export const createAdminUnitSchema = z
  .object({
    name: z
      .string({ message: "Unit name is required" })
      .trim()
      .min(1, "Unit name cannot be empty")
      .max(50, "Unit name cannot exceed 50 characters"),
    code: z
      .string({ message: "Unit code is required" })
      .trim()
      .min(1, "Unit code cannot be empty")
      .max(10, "Unit code cannot exceed 10 characters"),
    type: unitTypeEnum,
    baseUnitId: z
      .string()
      .trim()
      .uuid("Invalid Base Unit UUID format")
      .or(z.literal(""))
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    conversionFactor: z
      .number({ message: "Conversion factor is required" })
      .gt(0, "Conversion factor must be greater than 0")
      .default(1),
    sortOrder: z
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .max(100, "Sort order cannot exceed 100")
      .default(0)
      .optional(),
  })
  .strict();

export type CreateAdminUnitInput = z.infer<typeof createAdminUnitSchema>;

export const updateAdminUnitSchema = createAdminUnitSchema
  .partial()
  .strict();

export type UpdateAdminUnitInput = z.infer<typeof updateAdminUnitSchema>;

export const adminUnitsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  type: unitTypeEnum.optional(),
  hierarchy: unitHierarchyEnum.optional(),
});

export type AdminUnitsQueryInput = z.infer<typeof adminUnitsQuerySchema>;
