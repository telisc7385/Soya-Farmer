export const roundTo = (value: number, precision = 2): number => {
  const factor = Math.pow(10, precision);
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const ensurePositive = (value: number, field: string): number => {
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`${field} must be greater than zero`);
  }
  return value;
};
