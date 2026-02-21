export type CsvColumn<T> = {
  key: string;
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
};

const escapeCsvValue = (value: string) => {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const toCsv = <T>(columns: CsvColumn<T>[], rows: T[]) => {
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const dataLines = rows.map((row) => {
    const values = columns.map((c) => {
      const raw = c.value(row);
      if (raw === null || raw === undefined) return "";
      return escapeCsvValue(String(raw));
    });
    return values.join(",");
  });

  return [headerLine, ...dataLines].join("\n");
};

export const formatDate = (date?: Date | null) => {
  if (!date) return "";
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
};

export const buildCsvFilename = (prefix: string) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.csv`;
};
