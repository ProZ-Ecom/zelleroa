export type MeasurementType = "weight" | "volume" | "count" | "size";

export interface VariantMeasurement {
  type: MeasurementType;
  unit: string;
  unitId: string | null;
  value: number;
}

export interface MeasurementFieldConfig {
  type: MeasurementType;
  label: string;
  placeholder: string;
  helperText: string;
  unitBadge: string;
  validationMessage: string;
}

export function formatVariantMeasurement(
  unit: { id?: string | bigint | number | null; uuid?: string | null; type?: string | null; code?: string | null } | null | undefined,
  unitValue: number | bigint | unknown,
  explicitUnitId?: string | null
): VariantMeasurement {
  const rawType = unit?.type ? String(unit.type).toLowerCase() : "count";
  const type: MeasurementType =
    rawType === "weight" || rawType === "volume" || rawType === "count" || rawType === "size"
      ? (rawType as MeasurementType)
      : "count";

  const resolvedUnitId = explicitUnitId ?? (unit?.uuid || (unit?.id ? String(unit.id) : null));

  return {
    type,
    unit: unit?.code || "",
    unitId: resolvedUnitId,
    value: unitValue !== null && unitValue !== undefined ? Number(unitValue) : 0,
  };
}

const CLOTHING_SIZES = new Set([
  "xs", "s", "m", "l", "xl", "xxl", "2xl", "xxxl", "3xl", "4xl", "free size", "standard", "regular", "slim", "oversized"
]);

/**
 * Human-readable size / variant label for clothing or measurements.
 * Gracefully displays fashion sizes ("XS", "S", "M", "L", "XL", "XXL")
 * as clean size badges, while maintaining backward-compatible formatting.
 */
export function formatMeasurementLabel(measurement: VariantMeasurement | null | undefined): string {
  if (!measurement) return "";
  const value = measurement.value ?? 0;
  const unit = (measurement.unit ?? "").trim();
  const lowerUnit = unit.toLowerCase();

  // If the unit is a clothing size (e.g. XS, S, M, L, XL, XXL)
  if (unit && (measurement.type === "size" || CLOTHING_SIZES.has(lowerUnit))) {
    return CLOTHING_SIZES.has(lowerUnit) ? unit.toUpperCase() : unit; // "XL" or "32"
  }

  if (unit) {
    if (String(value) === unit) return unit;
    return value && value !== 1 ? `${value} ${unit}` : unit;
  }

  return value ? `${value}` : "Standard";

}

export function getMeasurementFieldConfig(
  unit?: { type?: string | null; code?: string | null; name?: string | null } | null
): MeasurementFieldConfig {
  if (!unit) {
    return {
      type: "weight",
      label: "Measurement Value",
      placeholder: "e.g. 500, 1",
      helperText: "Select a unit to specify measurement",
      unitBadge: "",
      validationMessage: "Measurement value is required and must be greater than 0",
    };
  }

  const rawType = unit.type ? String(unit.type).toLowerCase() : "";
  const type: MeasurementType =
    rawType === "weight" || rawType === "volume" || rawType === "count" || rawType === "size"
      ? (rawType as MeasurementType)
      : "weight";

  const unitCode = unit.code || "";
  const unitName = unit.name || "";

  switch (type) {
    case "size":
      return {
        type: "size",
        label: "Size value",
        placeholder: "1",
        helperText: `Leave as 1 — the size itself (${unitName || unitCode || "e.g. S, M, L"}) is set by the unit you picked above.`,
        unitBadge: unitCode || unitName,
        validationMessage: "Size value is required and must be greater than 0",
      };
    case "weight":
      return {
        type: "weight",
        label: unitCode ? `Weight (${unitCode})` : "Weight",
        placeholder: unitCode.toLowerCase() === "g" || unitCode.toLowerCase() === "gm" ? "e.g. 500" : "e.g. 1, 2",
        helperText: `Specify the weight in ${unitName ? unitName.toLowerCase() : unitCode}`,
        unitBadge: unitCode || unitName,
        validationMessage: "Weight is required and must be greater than 0",
      };
    case "volume":
      return {
        type: "volume",
        label: unitCode ? `Volume (${unitCode})` : "Volume",
        placeholder: unitCode.toLowerCase() === "ml" ? "e.g. 500" : "e.g. 1, 2",
        helperText: `Specify the volume in ${unitName ? unitName.toLowerCase() : unitCode}`,
        unitBadge: unitCode || unitName,
        validationMessage: "Volume is required and must be greater than 0",
      };
    case "count":
      return {
        type: "count",
        label: unitCode ? `Quantity (${unitCode})` : "Quantity",
        placeholder: "e.g. 1, 6, 12",
        helperText: `Specify the quantity in ${unitName ? unitName.toLowerCase() : unitCode}`,
        unitBadge: unitCode || unitName,
        validationMessage: "Quantity is required and must be greater than 0",
      };
    default:
      return {
        type: "weight",
        label: "Measurement Value",
        placeholder: "e.g. 500, 1",
        helperText: "Enter the measurement value",
        unitBadge: unitCode || unitName,
        validationMessage: "Measurement value is required and must be greater than 0",
      };
  }
}

