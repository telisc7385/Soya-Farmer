import { CsvColumn, formatDate } from "./csv";

export type ReportKey =
  | "bills"
  | "payments"
  | "stock-transfers"
  | "stocks"
  | "farmers"
  | "vendors"
  | "quality-rates";

type ReportConfig<T> = {
  filenamePrefix: string;
  columns: CsvColumn<T>[];
  columnsFn?: never;
  totalsRow?: (rows: T[]) => T | null;
};

type DynamicReportConfig<T> = {
  filenamePrefix: string;
  columns?: never;
  columnsFn: (rows: T[]) => CsvColumn<T>[];
  totalsRow?: (rows: T[]) => T | null;
};

export const billReportConfig: ReportConfig<any> = {
  filenamePrefix: "bills-report",
  columns: [
    { key: "billNo", header: "Bill No", value: (r) => r.billNo },
    {
      key: "billDate",
      header: "Bill Date",
      value: (r) => formatDate(r.billDate),
    },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    { key: "status", header: "Status", value: (r) => r.status },
    { key: "vendorName", header: "Vendor Name", value: (r) => r.vendor?.name },
    {
      key: "vendorPhone",
      header: "Vendor Phone",
      value: (r) => r.vendor?.phone,
    },
    { key: "farmerName", header: "Farmer Name", value: (r) => r.farmer?.name },
    {
      key: "farmerPhone",
      header: "Farmer Phone",
      value: (r) => r.farmer?.phone,
    },
    {
      key: "primaryQuantity",
      header: "Quantity",
      value: (r) => r.primaryQuantity,
    },
    { key: "primaryUnit", header: "Unit", value: (r) => r.primaryUnit },
    { key: "ratePerUnit", header: "Rate/Unit", value: (r) => r.ratePerUnit },
    { key: "grossAmount", header: "Gross Amount", value: (r) => r.grossAmount },
    { key: "totalAmount", header: "Total Amount", value: (r) => r.totalAmount },
    { key: "netPayable", header: "Net Payable", value: (r) => r.netPayable },
    { key: "goniType", header: "Goni Type", value: (r) => r.goniType?.name },
    { key: "bagCount", header: "Bag Count", value: (r) => r.bagCount },
    { key: "goniWeight", header: "Bag Weight", value: (r) => r.goniWeight },
    {
      key: "labWeight",
      header: "Net Weight For Lab",
      value: (r) => r.labWeight,
    },
    {
      key: "labDeductionWeight",
      header: "Lab Deduction Weight",
      value: (r) => r.labDeductionWeight,
    },
    {
      key: "netWeight",
      header: "Final Net Weight",
      value: (r) => r.netWeight,
    },
    {
      key: "totalDeductionAmount",
      header: "Total Deduction",
      value: (r) => r.totalDeductionAmount,
    },
    {
      key: "labDeductionAmount",
      header: "Lab Deduction Amount",
      value: (r) => r.labDeductionAmount,
    },
    {
      key: "fixedDeductionAmount",
      header: "Fixed Deduction Amount",
      value: (r) => r.fixedDeductionAmount,
    },
    {
      key: "deductionDetails",
      header: "Deduction Details",
      value: (r) => r.deductionDetails,
    },
  ],
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const sum = (key: string) =>
      rows.reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
    return {
      billNo: "TOTAL",
      primaryQuantity: sum("primaryQuantity"),
      grossAmount: sum("grossAmount"),
      totalAmount: sum("totalAmount"),
      netPayable: sum("netPayable"),
      bagCount: sum("bagCount"),
      goniWeight: sum("goniWeight"),
      labWeight: sum("labWeight"),
      labDeductionWeight: sum("labDeductionWeight"),
      netWeight: sum("netWeight"),
      totalDeductionAmount: sum("totalDeductionAmount"),
      labDeductionAmount: sum("labDeductionAmount"),
      fixedDeductionAmount: sum("fixedDeductionAmount"),
    };
  },
};

export const paymentReportConfig: ReportConfig<any> = {
  filenamePrefix: "payments-report",
  columns: [
    { key: "billNo", header: "Bill No", value: (r) => r.bill?.billNo },
    {
      key: "billCreatedAt",
      header: "Bill Created At",
      value: (r) => formatDate(r.bill?.createdAt),
    },
    { key: "farmerName", header: "Farmer Name", value: (r) => r.farmer?.name },
    {
      key: "farmerPhone",
      header: "Farmer Phone",
      value: (r) => r.farmer?.phone,
    },
    {
      key: "vendorName",
      header: "Vendor Name",
      value: (r) => r.bill?.vendor?.name,
    },
    { key: "amount", header: "Amount", value: (r) => r.amount },
    { key: "status", header: "Status", value: (r) => r.status },
    {
      key: "paidDate",
      header: "Paid Date",
      value: (r) => formatDate(r.paidDate),
    },
    { key: "reference", header: "Reference", value: (r) => r.reference },
  ],
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const totalAmount = rows.reduce(
      (acc, row) => acc + (Number(row?.amount) || 0),
      0,
    );
    return { bill: { billNo: "TOTAL" }, amount: totalAmount };
  },
};

export const stockTransferReportConfig: ReportConfig<any> = {
  filenamePrefix: "stock-transfers-report",
  columns: [
    { key: "transferNo", header: "Transfer No", value: (r) => r.transferNo },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    {
      key: "completedAt",
      header: "Completed At",
      value: (r) => formatDate(r.completedAt),
    },
    { key: "status", header: "Status", value: (r) => r.status },
    { key: "vendorName", header: "Vendor Name", value: (r) => r.vendor?.name },
    {
      key: "vendorPhone",
      header: "Vendor Phone",
      value: (r) => r.vendor?.phone,
    },
    { key: "goniType", header: "Goni Type", value: (r) => r.goniType?.name },
    { key: "weight", header: "Weight", value: (r) => r.weight },
    { key: "unit", header: "Unit", value: (r) => r.unit },
    { key: "bagCount", header: "Bag Count", value: (r) => r.bagCount },
    {
      key: "sourceLocation",
      header: "Source Location",
      value: (r) => r.sourceLocation?.name,
    },
    {
      key: "destinationLocation",
      header: "Destination Location",
      value: (r) => r.destinationLocation?.name,
    },
    {
      key: "vehicalNumber",
      header: "Vehicle Number",
      value: (r) => r.vehicalNumber,
    },
  ],
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const sum = (key: string) =>
      rows.reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
    return {
      transferNo: "TOTAL",
      weight: sum("weight"),
      bagCount: sum("bagCount"),
    };
  },
};

export const stockReportConfig: ReportConfig<any> = {
  filenamePrefix: "stocks-report",
  columns: [
    { key: "billNo", header: "Bill No", value: (r) => r.bill?.billNo },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    {
      key: "updatedAt",
      header: "Updated At",
      value: (r) => formatDate(r.updatedAt),
    },
    { key: "status", header: "Status", value: (r) => r.status },
    { key: "vendorName", header: "Vendor Name", value: (r) => r.vendor?.name },
    {
      key: "vendorPhone",
      header: "Vendor Phone",
      value: (r) => r.vendor?.phone,
    },
    { key: "goniType", header: "Goni Type", value: (r) => r.goniType?.name },
    { key: "weight", header: "Weight", value: (r) => r.weight },
    { key: "unit", header: "Unit", value: (r) => r.unit },
    { key: "bagCount", header: "Bag Count", value: (r) => r.bagCount },
  ],
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const sum = (key: string) =>
      rows.reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
    return {
      bill: { billNo: "TOTAL" },
      weight: sum("weight"),
      bagCount: sum("bagCount"),
    };
  },
};

export const farmerReportConfig: ReportConfig<any> = {
  filenamePrefix: "farmers-report",
  columns: [
    { key: "name", header: "Farmer Name", value: (r) => r.name },
    { key: "phone", header: "Phone", value: (r) => r.phone },
    { key: "aadhaarNo", header: "Aadhaar No", value: (r) => r.aadhaarNo },
    { key: "villageAdd", header: "Village", value: (r) => r.villageAdd },
    { key: "taluka", header: "Taluka", value: (r) => r.taluka },
    { key: "district", header: "District", value: (r) => r.district },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    {
      key: "totalDocuments",
      header: "Total Documents",
      value: (r) => r._count?.documents,
    },
    { key: "totalLands", header: "Total Lands", value: (r) => r._count?.lands },
    { key: "totalBills", header: "Total Bills", value: (r) => r._count?.bills },
    {
      key: "lastBillNo",
      header: "Last Bill No",
      value: (r) => r.lastBill?.billNo,
    },
    {
      key: "lastBillDate",
      header: "Last Bill Date",
      value: (r) => formatDate(r.lastBill?.billDate),
    },
  ],
};

export const vendorReportConfig: ReportConfig<any> = {
  filenamePrefix: "vendors-report",
  columns: [
    { key: "name", header: "Vendor Name", value: (r) => r.name },
    { key: "phone", header: "Phone", value: (r) => r.phone },
    { key: "email", header: "Email", value: (r) => r.email },
    { key: "isActive", header: "Active", value: (r) => r.isActive },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    {
      key: "totalBills",
      header: "Total Bills",
      value: (r) => r.totalBills ?? 0,
    },
    {
      key: "totalFarmers",
      header: "Total Farmers",
      value: (r) => r.totalFarmers ?? 0,
    },
    {
      key: "paidAmount",
      header: "Paid Amount",
      value: (r) => r.paidAmount ?? 0,
    },
    {
      key: "pendingAmount",
      header: "Pending Amount",
      value: (r) => r.pendingAmount ?? 0,
    },
    {
      key: "failedAmount",
      header: "Failed Amount",
      value: (r) => r.failedAmount ?? 0,
    },
  ],
};

export const qualityRateReportConfig: DynamicReportConfig<any> = {
  filenamePrefix: "quality-rates-report",
  columnsFn: (rows) => {
    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (key !== "date") keys.add(key);
      }
    }
    return [
      { key: "date", header: "Date", value: (r) => r.date },
      ...Array.from(keys).map((key) => ({
        key,
        header: key,
        value: (r: any) => r[key],
      })),
    ];
  },
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const totals: Record<string, any> = { date: "AVERAGE" };
    const sample = rows[0];
    for (const key of Object.keys(sample)) {
      if (key === "date") continue;
      const sum = rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
      totals[key] = rows.length ? sum / rows.length : 0;
    }
    return totals;
  },
};

export const reportConfigs: Record<ReportKey, ReportConfig<any> | DynamicReportConfig<any>> = {
  bills: billReportConfig,
  payments: paymentReportConfig,
  "stock-transfers": stockTransferReportConfig,
  stocks: stockReportConfig,
  farmers: farmerReportConfig,
  vendors: vendorReportConfig,
  "quality-rates": qualityRateReportConfig,
};
