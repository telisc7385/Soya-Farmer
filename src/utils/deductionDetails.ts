type RecordMap = Record<string, number>;

const normalizeInputs = (master: any, record: Record<string, unknown>) => {
  const normalized: RecordMap = {};
  for (const variable of master.variables || []) {
    const value = record[variable.code];
    if (typeof value === "number") {
      normalized[variable.code] = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        normalized[variable.code] = parsed;
      }
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
};

export const attachDeductionDetails = (bill: any) => {
  if (!bill || !Array.isArray(bill.deductions)) return bill;

  const deductions = bill.deductions.map((deduction: any) => {
    const master = deduction.master;
    if (!master || master.type !== "FORMULA") return deduction;

    const payload =
      typeof deduction.payload === "object" && deduction.payload !== null
        ? (deduction.payload as Record<string, unknown>)
        : undefined;
    if (!payload) return deduction;

    const actualInputs = payload.actualInputs
      ? normalizeInputs(master, payload.actualInputs as Record<string, unknown>)
      : undefined;
    const customInputs = payload.customInputs
      ? normalizeInputs(master, payload.customInputs as Record<string, unknown>)
      : undefined;
    const deductedInputs = payload.deductedInputs
      ? normalizeInputs(
          master,
          payload.deductedInputs as Record<string, unknown>,
        )
      : undefined;
    const deductedAmounts = payload.deductedAmounts
      ? normalizeInputs(
          master,
          payload.deductedAmounts as Record<string, unknown>,
        )
      : undefined;
    if (!actualInputs && !customInputs && !deductedInputs) return deduction;

    const variableDeductions: RecordMap = {};
    const variableDetails: Array<{
      code: string;
      label?: string;
      unitHint?: string | null;
      actual: number;
      custom: number;
      deducted: number;
      deductionValue: number;
    }> = [];
    for (const variable of master.variables || []) {
      const actual = actualInputs?.[variable.code] ?? 0;
      const custom = customInputs?.[variable.code] ?? 0;
      const deducted = deductedInputs?.[variable.code] ?? 0;
      const deductionValue = deductedAmounts?.[variable.code] ?? 0;
      if (deducted > 0) {
        variableDeductions[variable.code] = deducted;
      }
      variableDetails.push({
        code: variable.code,
        label: variable.label,
        unitHint: variable.unitHint,
        actual,
        custom,
        deducted,
        deductionValue,
      });
    }

    return {
      ...deduction,
      // actualInputs,
      // customInputs,
      // deductedInputs,
      // deductedAmounts,
      // variableDeductions,
      // variableDetails,
    };
  });

  return { ...bill, deductions };
};
