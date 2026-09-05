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
      key: "vendorBillSeq",
      header: "Vendor Bill Seq",
      value: (r) => r.vendorBillSeq,
    },
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
    {
      key: "vendorEmail",
      header: "Vendor Email",
      value: (r) => r.vendor?.email,
    },
    { key: "farmerName", header: "Farmer Name", value: (r) => r.farmer?.name },
    {
      key: "farmerPhone",
      header: "Farmer Phone",
      value: (r) => r.farmer?.phone,
    },
    {
      key: "farmerEmail",
      header: "Farmer Email",
      value: (r) => r.farmer?.email,
    },
    {
      key: "farmerAadhaar",
      header: "Farmer Aadhaar",
      value: (r) => r.farmer?.aadhaarNo,
    },
    { key: "farmerPan", header: "Farmer PAN", value: (r) => r.farmer?.panNo },
    {
      key: "farmerVillage",
      header: "Farmer Village",
      value: (r) => r.farmer?.villageAdd,
    },
    {
      key: "farmerTaluka",
      header: "Farmer Taluka",
      value: (r) => r.farmer?.taluka,
    },
    {
      key: "farmerDistrict",
      header: "Farmer District",
      value: (r) => r.farmer?.district,
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
    {
      key: "vehicleNumber",
      header: "Vehicle Number",
      value: (r) => r.vehicleNumber,
    },
    { key: "vehicleType", header: "Vehicle Type", value: (r) => r.vehicleType },
    { key: "driverName", header: "Driver Name", value: (r) => r.driverName },
    { key: "billLocation", header: "Bill Location", value: (r) => r.billLocation },
    { key: "remark", header: "Remark", value: (r) => r.remark },
    { key: "remarkUrl", header: "Remark URL", value: (r) => r.remarkUrl },
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
    {
      key: "paymentStatus",
      header: "Payment Status",
      value: (r) => r.payment?.status,
    },
    {
      key: "paymentAmount",
      header: "Payment Amount",
      value: (r) => r.payment?.amount,
    },
    {
      key: "paymentPaidDate",
      header: "Payment Paid Date",
      value: (r) => formatDate(r.payment?.paidDate),
    },
    {
      key: "paymentReference",
      header: "Payment Reference",
      value: (r) => r.payment?.reference,
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
      paymentAmount: rows.reduce(
        (acc, row) => acc + (Number(row?.payment?.amount) || 0),
        0,
      ),
    };
  },
};

export const paymentReportConfig: ReportConfig<any> = {
  filenamePrefix: "payments-report",
  columns: [
    { key: "billNo", header: "Bill No", value: (r) => r.bill?.billNo },
    {
      key: "billDate",
      header: "Bill Date",
      value: (r) => formatDate(r.bill?.billDate),
    },
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
      key: "farmerAadhaar",
      header: "Farmer Aadhaar",
      value: (r) => r.farmer?.aadhaarNo,
    },
    {
      key: "farmerEmail",
      header: "Farmer Email",
      value: (r) => r.farmer?.email,
    },
    {
      key: "vendorName",
      header: "Vendor Name",
      value: (r) => r.bill?.vendor?.name,
    },
    {
      key: "vendorPhone",
      header: "Vendor Phone",
      value: (r) => r.bill?.vendor?.phone,
    },
    {
      key: "vendorEmail",
      header: "Vendor Email",
      value: (r) => r.bill?.vendor?.email,
    },
    {
      key: "vendorIsActive",
      header: "Vendor Active",
      value: (r) => r.bill?.vendor?.isActive,
    },
    { key: "billStatus", header: "Bill Status", value: (r) => r.bill?.status },
    {
      key: "billTotalAmount",
      header: "Bill Total Amount",
      value: (r) => r.bill?.totalAmount,
    },
    {
      key: "billNetPayable",
      header: "Bill Net Payable",
      value: (r) => r.bill?.netPayable,
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
    {
      key: "toVendorName",
      header: "To Vendor Name",
      value: (r) => r.toVendor?.name,
    },
    { key: "goniType", header: "Goni Type", value: (r) => r.goniType?.name },
    {
      key: "vendorEnteredWeight",
      header: "Vendor Entered Weight",
      value: (r) => r.vendorEnteredWeight,
    },
    {
      key: "vendorEnteredUnit",
      header: "Vendor Entered Unit",
      value: (r) => r.vendorEnteredUnit,
    },
    {
      key: "adminAdjustedWeight",
      header: "Admin Adjusted Weight",
      value: (r) => r.adminAdjustedWeight,
    },
    {
      key: "adminAdjustedUnit",
      header: "Admin Adjusted Unit",
      value: (r) => r.adminAdjustedUnit,
    },
    {
      key: "adminAdjustedAt",
      header: "Admin Adjusted At",
      value: (r) => formatDate(r.adminAdjustedAt),
    },
    { key: "weight", header: "Weight", value: (r) => r.weight },
    { key: "unit", header: "Unit", value: (r) => r.unit },
    { key: "bagCount", header: "Bag Count", value: (r) => r.bagCount },
    {
      key: "vehicalNumber",
      header: "Vehicle Number",
      value: (r) => r.vehicalNumber,
    },
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
      key: "dispatchedWeight",
      header: "Dispatched Weight",
      value: (r) => r.dispatchedWeight,
    },
    {
      key: "dispatchedBagCount",
      header: "Dispatched Bag Count",
      value: (r) => r.dispatchedBagCount,
    },
    {
      key: "dispatchedAt",
      header: "Dispatched At",
      value: (r) => formatDate(r.dispatchedAt),
    },
    {
      key: "dispatchLocationText",
      header: "Dispatch Location Text",
      value: (r) => r.dispatchLocationText,
    },
    {
      key: "dispatchProofUrl",
      header: "Dispatch Proof URL",
      value: (r) => r.dispatchProofUrl,
    },
    {
      key: "receivedWeight",
      header: "Received Weight",
      value: (r) => r.receivedWeight,
    },
    {
      key: "receivedBagCount",
      header: "Received Bag Count",
      value: (r) => r.receivedBagCount,
    },
    {
      key: "receivedAt",
      header: "Received At",
      value: (r) => formatDate(r.receivedAt),
    },
    {
      key: "receiveLocationText",
      header: "Receive Location Text",
      value: (r) => r.receiveLocationText,
    },
    {
      key: "receiveProofUrl",
      header: "Receive Proof URL",
      value: (r) => r.receiveProofUrl,
    },
    {
      key: "weightShortage",
      header: "Weight Shortage",
      value: (r) => r.weightShortage,
    },
    { key: "bagShortage", header: "Bag Shortage", value: (r) => r.bagShortage },
  ],
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const sum = (key: string) =>
      rows.reduce((acc, row) => acc + (Number(row?.[key]) || 0), 0);
    return {
      transferNo: "TOTAL",
      bagCount: sum("bagCount"),
      weight: sum("weight"),
      vendorEnteredWeight: sum("vendorEnteredWeight"),
      adminAdjustedWeight: sum("adminAdjustedWeight"),
      dispatchedWeight: sum("dispatchedWeight"),
      receivedWeight: sum("receivedWeight"),
      weightShortage: sum("weightShortage"),
      bagShortage: sum("bagShortage"),
    };
  },
};

export const stockReportConfig: ReportConfig<any> = {
  filenamePrefix: "stocks-report",
  columns: [
    { key: "billNo", header: "Bill No", value: (r) => r.bill?.billNo },
    { key: "vendorName", header: "Vendor Name", value: (r) => r.vendor?.name },
    {
      key: "vendorPhone",
      header: "Vendor Phone",
      value: (r) => r.vendor?.phone,
    },
    {
      key: "vendorEmail",
      header: "Vendor Email",
      value: (r) => r.vendor?.email,
    },
    { key: "goniType", header: "Goni Type", value: (r) => r.goniType?.name },
    { key: "weight", header: "Weight", value: (r) => r.weight },
    { key: "unit", header: "Unit", value: (r) => r.unit },
    { key: "bagCount", header: "Bag Count", value: (r) => r.bagCount },
    { key: "status", header: "Status", value: (r) => r.status },
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
    {
      key: "billDate",
      header: "Bill Date",
      value: (r) => formatDate(r.bill?.billDate),
    },
    {
      key: "billStatus",
      header: "Bill Status",
      value: (r) => r.bill?.status,
    },
    {
      key: "billTotalAmount",
      header: "Bill Total Amount",
      value: (r) => r.bill?.totalAmount,
    },
    {
      key: "billNetPayable",
      header: "Bill Net Payable",
      value: (r) => r.bill?.netPayable,
    },
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
    { key: "panNo", header: "PAN No", value: (r) => r.panNo },
    { key: "email", header: "Email", value: (r) => r.email },
    { key: "profileUrl", header: "Profile URL", value: (r) => r.profileUrl },
    { key: "villageAdd", header: "Village", value: (r) => r.villageAdd },
    { key: "taluka", header: "Taluka", value: (r) => r.taluka },
    { key: "district", header: "District", value: (r) => r.district },
    {
      key: "createdAt",
      header: "Created At",
      value: (r) => formatDate(r.createdAt),
    },
    { key: "kycStatus", header: "KYC Status", value: (r) => r.kycStatus },
    {
      key: "kycSubmittedAt",
      header: "KYC Submitted At",
      value: (r) => formatDate(r.kycSubmittedAt),
    },
    {
      key: "kycVerifiedAt",
      header: "KYC Verified At",
      value: (r) => formatDate(r.kycVerifiedAt),
    },
    {
      key: "kycRejectionReason",
      header: "KYC Rejection Reason",
      value: (r) => r.kycRejectionReason,
    },
    {
      key: "reKycDate",
      header: "Re-KYC Date",
      value: (r) => formatDate(r.reKycDate),
    },
    {
      key: "reKycStatus",
      header: "Re-KYC Status",
      value: (r) => r.reKycStatus,
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
    { key: "role", header: "Role", value: (r) => r.role },
    { key: "isActive", header: "Active", value: (r) => r.isActive },
    { key: "vendorRate", header: "Vendor Rate", value: (r) => r.vendorRate },
    {
      key: "factoryRateDiff",
      header: "Factory Rate Diff",
      value: (r) => r.factoryRateDiff,
    },
    { key: "masterVendor", header: "Master Vendor", value: (r) => r.masterVendor },
    { key: "grnNumber", header: "GRN Number", value: (r) => r.grnNumber },
    { key: "villageAdd", header: "Village", value: (r) => r.villageAdd },
    { key: "taluka", header: "Taluka", value: (r) => r.taluka },
    { key: "district", header: "District", value: (r) => r.district },
    {
      key: "purchaseLimitQtlPerHectare",
      header: "Purchase Limit Qtl/Hectare",
      value: (r) => r.purchaseLimitQtlPerHectare,
    },
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
        if (key === "date" || key === "baseRate") continue;
        keys.add(key);
      }
    }
    return [
      { key: "date", header: "Date", value: (r) => r.date },
      {
        key: "baseRate",
        header: "Base Rate",
        value: (r) => (r.baseRate !== undefined ? r.baseRate : ""),
      },
      ...Array.from(keys).map((key) => ({
        key,
        header: key,
        value: (r: any) => r[key],
      })),
    ];
  },
  totalsRow: (rows) => {
    if (!rows.length) return null;
    const totals: Record<string, any> = {};
    const sample = rows[0];
    for (const key of Object.keys(sample)) {
      const sum = rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
      if (key === "date") {
        totals.date = "AVERAGE";
      } else if (key === "baseRate") {
        totals.baseRate = rows.length ? sum / rows.length : 0;
      } else {
        totals[key] = rows.length ? sum / rows.length : 0;
      }
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