// src/routes/farmer.routes.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import {
  createAgainstSettlement,
  createFarmerAdvance,
  getBillSettlements,
  getFarmerAdvanceBalanceController,
  getFarmerAdvances,
  getPayments,
  payFarmer,
  rejectBill,
} from "../controllers/adminPayment.controller";
import {
  createDeductionMaster,
  listDeductionMasters,
  toggleDeductionMaster,
  updateDeductionMaster,
} from "../controllers/admin/deductionMaster.controller";
import {
  createGoniType,
  listGoniTypes,
  updateGoniType,
} from "../controllers/admin/goniType.controller";
import {
  changeQualityRateStatus,
  deleteQualityRate,
  listAllQualityRates,
  saveQualityRate,
} from "../controllers/qualityRate.controller";
import * as transferController from "../controllers/stockTransfer.controller";
import * as bagController from "../controllers/bag.controller";
import {
  validateRequest,
  validateQuery,
} from "../middleware/validateRequest.middleware";
import {
  createAdvanceSchema,
  payFarmerSchema,
  rejectFarmerSchema,
  createSettlementSchema as createSettlementValidationSchema,
} from "../validations/payment.validation";
import {
  createDeductionMasterSchema,
  updateDeductionMasterSchema,
  toggleDeductionMasterSchema,
  createGoniTypeSchema,
  updateGoniTypeSchema,
  saveQualityRateSchema,
} from "../validations/admin.validation";
import {
  adminReturnBagsToVendorSchema,
  adminOpeningBagsToVendorSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
  updateTransferSchema,
} from "../validations/stock.validation";
import { rejectKycSchema } from "../validations/farmer.validation";
import {
  verifyFarmerKyc,
  rejectFarmerKyc,
  getPendingKycFarmers,
} from "../controllers/farmer.controller";
import { exportReportSchema } from "../validations/report.validation";
import { exportAdminReport } from "../controllers/admin/adminReport.controller";
import {
  getAdminDashboardSummary,
  getLocationLedger,
  getLocationWiseStockSummary,
  getVendorTrends,
} from "../controllers/admin/adminAnalytics.controller";
import { adminAnalyticsQuerySchema } from "../validations/adminAnalytics.validation";
import {
  createInventoryLocation,
  listInventoryLocations,
  updateInventoryLocation,
} from "../controllers/inventoryLocation.controller";
import {
  createInventoryLocationSchema,
  listInventoryLocationQuerySchema,
  updateInventoryLocationSchema,
} from "../validations/inventoryLocation.validation";
const router = Router();

router.get("/payments", authMiddleware, authorize("ADMIN"), getPayments);

router.post(
  "/:billId/pay",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(payFarmerSchema),
  payFarmer,
);

router.post(
  "/:billId/reject",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(rejectFarmerSchema),
  rejectBill,
);

router.post(
  "/farmers/:farmerId/advances",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createAdvanceSchema),
  createFarmerAdvance,
);

router.get(
  "/farmers/:farmerId/advances",
  authMiddleware,
  authorize("ADMIN"),
  getFarmerAdvances,
);

router.get(
  "/farmers/:farmerId/advance-balance",
  authMiddleware,
  authorize("ADMIN"),
  getFarmerAdvanceBalanceController,
);

router.post(
  "/bills/:billId/settlements",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createSettlementValidationSchema),
  createAgainstSettlement,
);

router.get(
  "/bills/:billId/settlements",
  authMiddleware,
  authorize("ADMIN"),
  getBillSettlements,
);
router.post(
  "/deductions",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createDeductionMasterSchema),
  createDeductionMaster,
);

router.put(
  "/deductions/:masterId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateDeductionMasterSchema),
  updateDeductionMaster,
);

router.patch(
  "/deductions/:masterId/toggle",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(toggleDeductionMasterSchema),
  toggleDeductionMaster,
);

router.get("/deductions", authMiddleware, listDeductionMasters);

router.post(
  "/goni-types",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createGoniTypeSchema),
  createGoniType,
);

router.put(
  "/goni-types/:goniTypeId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateGoniTypeSchema),
  updateGoniType,
);

router.get("/goni-types", authMiddleware, listGoniTypes);

router.post(
  "/bags/vendor/:vendorId/return",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(adminReturnBagsToVendorSchema),
  bagController.adminReturnBagsToVendor,
);

router.post(
  "/bags/vendor/:vendorId/opening",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(adminOpeningBagsToVendorSchema),
  bagController.adminOpeningBagsToVendor,
);

router.post(
  "/quality-rates",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(saveQualityRateSchema),
  saveQualityRate,
);

router.get(
  "/quality-rates",
  authMiddleware,
  authorize("ADMIN"),
  listAllQualityRates,
);

router.put(
  "/quality-rates/:qualityId",
  authMiddleware,
  authorize("ADMIN"),
  changeQualityRateStatus,
);

router.delete(
  "/quality-rates/:qualityId",
  authMiddleware,
  authorize("ADMIN"),
  deleteQualityRate,
);

// =====================
// STOCK TRANSFER ROUTES (ADMIN)
// =====================

// Get all transfers
router.get(
  "/transfers",
  authMiddleware,
  authorize("ADMIN"),
  transferController.getAdminTransfers,
);

// Complete transfer
router.put(
  "/transfers/:transferId/complete",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(dispatchTransferSchema),
  transferController.completeTransfer,
);

router.put(
  "/transfers/:transferId/receive",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(receiveTransferSchema),
  transferController.receiveTransfer,
);

// Update transfer (only weight and unit)
router.put(
  "/transfers/:transferId/update",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateTransferSchema),
  transferController.updateTransfer,
);

// Get admin stock summary
router.get(
  "/stock/summary",
  authMiddleware,
  authorize("ADMIN"),
  transferController.getAdminStockSummary,
);

// =====================
// ADMIN REPORTS (CSV EXPORT)
// =====================
router.get(
  "/reports/:reportType/export",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(exportReportSchema),
  exportAdminReport,
);

// =====================
// ADMIN ANALYTICS
// =====================
router.get(
  "/analytics/dashboard",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(adminAnalyticsQuerySchema),
  getAdminDashboardSummary,
);

router.get(
  "/analytics/vendor-trends",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(adminAnalyticsQuerySchema),
  getVendorTrends,
);

router.get(
  "/analytics/location-stock",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(adminAnalyticsQuerySchema),
  getLocationWiseStockSummary,
);

router.get(
  "/analytics/location-ledger",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(adminAnalyticsQuerySchema),
  getLocationLedger,
);

// =====================
// INVENTORY LOCATIONS (ADMIN)
// =====================
router.post(
  "/inventory-locations",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(createInventoryLocationSchema),
  createInventoryLocation,
);

router.get(
  "/inventory-locations",
  authMiddleware,
  authorize("ADMIN"),
  validateQuery(listInventoryLocationQuerySchema),
  listInventoryLocations,
);

router.put(
  "/inventory-locations/:locationId",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(updateInventoryLocationSchema),
  updateInventoryLocation,
);

// =====================
// ADMIN KYC VERIFICATION
// =====================
router.get(
  "/kyc/pending",
  authMiddleware,
  authorize("ADMIN"),
  getPendingKycFarmers,
);

router.put(
  "/kyc/:farmerId/verify",
  authMiddleware,
  authorize("ADMIN"),
  verifyFarmerKyc,
);

router.put(
  "/kyc/:farmerId/reject",
  authMiddleware,
  authorize("ADMIN"),
  validateRequest(rejectKycSchema),
  rejectFarmerKyc,
);

export default router;
