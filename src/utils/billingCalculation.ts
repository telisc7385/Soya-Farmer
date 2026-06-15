import { roundTo } from "./number";

type AnyRecord = Record<string, any>;
type DeductionRow = {
  deductionId: string | undefined;
  masterId: string | undefined;
  label: string | undefined;
  type: string;
  deductionPercent: number;
  deductionWeight: number;
  deductionAmount: number;
  actualInputs: AnyRecord | null;
  allowedInputs: AnyRecord | null;
  deductedInputs: AnyRecord | null;
  deductedWeights: AnyRecord | null;
  deductedAmounts: AnyRecord | null;
  variableDetails: any[] | null;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
};

const sumObjectValues = (record?: AnyRecord): number => {
  if (!record || typeof record !== "object") return 0;
  return Object.values(record).reduce((sum, value) => sum + asNumber(value), 0);
};

export const buildBillingCalculationDetails = (bill: any) => {
  const totalQuantityReceived = asNumber(bill?.primaryQuantity);
  const ratePerUnit = asNumber(bill?.ratePerUnit);
  const bagWeight = asNumber(bill?.goniWeight);

  const netWeightForLab = roundTo(
    Math.max(totalQuantityReceived - bagWeight, 0),
    3,
  );
  const goniDeductionAmount = roundTo(bagWeight * ratePerUnit);
  const deductions = Array.isArray(bill?.deductions) ? bill.deductions : [];

  const deductionRows: DeductionRow[] = deductions.map((deduction: any) => {
    const payload =
      deduction?.payload && typeof deduction.payload === "object"
        ? (deduction.payload as AnyRecord)
        : undefined;
    const percent =
      asNumber(payload?.totalDeductionPercent) ||
      sumObjectValues(payload?.deductedInputs);
    const weight =
      asNumber(payload?.deductionWeight) ||
      roundTo((netWeightForLab * percent) / 100, 3);
    const amount =
      asNumber(payload?.deductionAmount) ||
      asNumber(deduction?.value) ||
      roundTo(weight * ratePerUnit);

    return {
      deductionId: deduction?.id,
      masterId: deduction?.masterId,
      label: deduction?.label,
      type: deduction?.master?.type ?? "FORMULA",
      deductionPercent: roundTo(percent, 4),
      deductionWeight: roundTo(weight, 3),
      deductionAmount: roundTo(amount),
      actualInputs: payload?.actualInputs ?? null,
      allowedInputs: payload?.customInputs ?? null,
      deductedInputs: payload?.deductedInputs ?? null,
      deductedWeights: payload?.deductedWeights ?? null,
      deductedAmounts: payload?.deductedAmounts ?? null,
      variableDetails: payload?.variableDetails ?? null,
    };
  });

  const labRows = deductionRows.filter(
    (row: DeductionRow) => row.type === "FORMULA",
  );
  const fixedRows = deductionRows.filter(
    (row: DeductionRow) => row.type !== "FORMULA",
  );

  const totalLabDeductionPercent = roundTo(
    labRows.reduce(
      (sum: number, row: DeductionRow) => sum + row.deductionPercent,
      0,
    ),
    4,
  );
  const totalLabDeductionWeight = roundTo(
    labRows.reduce(
      (sum: number, row: DeductionRow) => sum + row.deductionWeight,
      0,
    ),
    3,
  );
  const totalLabDeductionAmount = roundTo(
    labRows.reduce(
      (sum: number, row: DeductionRow) => sum + row.deductionAmount,
      0,
    ),
  );
  const totalFixedDeductionAmount = roundTo(
    fixedRows.reduce(
      (sum: number, row: DeductionRow) => sum + row.deductionAmount,
      0,
    ),
  );

  const finalNetPayableWeight = roundTo(
    Math.max(netWeightForLab - totalLabDeductionWeight, 0),
    2,
  );
  const amountAfterLab = roundTo(finalNetPayableWeight * ratePerUnit);
  const finalPayableAmount = roundTo(
    Math.max(amountAfterLab - totalFixedDeductionAmount, 0),
    0,
  );
  const rateAfterLabDeduction = roundTo(
    Math.max(ratePerUnit - (ratePerUnit * totalLabDeductionPercent) / 100, 0),
    4,
  );
  const recalculatedTotal = roundTo(rateAfterLabDeduction * netWeightForLab);

  return {
    totalQuantityReceived,
    ratePerUnit,
    bagWeight,
    netWeightForLab,
    goniDeductionAmount,
    totalLabDeductionPercent,
    totalLabDeductionWeight,
    totalLabDeductionAmount,
    totalFixedDeductionAmount,
    finalNetPayableWeight,
    amountAfterLab,
    finalPayableAmount,
    rateAfterLabDeduction,
    rateAfterLabDeductionRounded: roundTo(rateAfterLabDeduction, 2),
    recalculatedTotal,
    pricedQuantity: netWeightForLab,
    // deductions: deductionRows,
  };
};
