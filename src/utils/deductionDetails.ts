import { formulaEngine } from "../services/formulaEngine.service";

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

export const parseDefaultInputs = (master: any): RecordMap | undefined => {
  const raw = master?.variableValues;
  if (!raw) return undefined;

  const normalizeRecord = (record: Record<string, unknown>) =>
    normalizeInputs(master, record);

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return normalizeRecord(raw as Record<string, unknown>);
  }

  if (Array.isArray(raw) && raw.length) {
    const first = raw[0];
    if (typeof first === "object" && first !== null) {
      return normalizeRecord(first as Record<string, unknown>);
    }
    if (typeof first === "string") {
      const matches = first.match(/-?\d+(\.\d+)?/g) || [];
      if (!matches.length) return undefined;
      const values = matches.map((v) => Number(v));
      const mapped: RecordMap = {};
      for (let i = 0; i < master.variables.length; i += 1) {
        if (typeof values[i] === "number" && !Number.isNaN(values[i])) {
          mapped[master.variables[i].code] = values[i];
        }
      }
      return Object.keys(mapped).length ? mapped : undefined;
    }
    if (typeof first === "number") {
      const mapped: RecordMap = {};
      if (master.variables?.[0]) {
        mapped[master.variables[0].code] = first;
      }
      return Object.keys(mapped).length ? mapped : undefined;
    }
  }

  return undefined;
};

const safeEvaluate = (
  expression: string | null | undefined,
  inputs: RecordMap,
) => {
  if (!expression) return undefined;
  try {
    return formulaEngine.evaluate(expression, inputs);
  } catch {
    return undefined;
  }
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
      ? normalizeInputs(master, payload.deductedInputs as Record<string, unknown>)
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
    }> = [];
    for (const variable of master.variables || []) {
      const actual = actualInputs?.[variable.code] ?? 0;
      const custom = customInputs?.[variable.code] ?? 0;
      const deducted = deductedInputs?.[variable.code] ?? 0;
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
      });
    }

    return {
      actualInputs,
      customInputs,
      deductedInputs,
      variableDeductions,
      variableDetails,
    };
  });

  return { ...bill, deductions };
};
