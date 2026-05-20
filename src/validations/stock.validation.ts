import Joi from "joi";

// =====================
// TRANSFER VALIDATIONS
// =====================
export const createTransferSchema = Joi.object({
  weight: Joi.number().positive().optional(),
  unit: Joi.string().valid("QTL", "MT").optional(),
  bagCount: Joi.number().integer().min(1).optional(),
  goniTypeId: Joi.string().uuid().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        goniTypeId: Joi.string().uuid().required(),
        bagCount: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .optional(),
  sourceLocationId: Joi.string().uuid().required(),
  destinationLocationId: Joi.string().uuid().required(),
  vehicalNumber: Joi.string().max(50).required(),
}).custom((value, helpers) => {
  const hasItems = Array.isArray(value.items) && value.items.length > 0;
  const hasSingle = !!value.goniTypeId && typeof value.bagCount === "number";

  if (!hasItems && !hasSingle) {
    return helpers.error("any.custom", {
      message:
        "Provide either items[] for multi-type transfer or goniTypeId + bagCount for single type",
    });
  }

  if (value.sourceLocationId === value.destinationLocationId) {
    return helpers.error("any.custom", {
      message: "Source and destination locations must be different",
    });
  }

  return value;
}, "transfer item validation");

export const listTransferQuerySchema = Joi.object({
  status: Joi.string()
    .valid(
      "PENDING",
      "DISPATCHED",
      "RECEIVED",
      "DISCREPANCY",
      "COMPLETED",
      "CANCELLED",
    )
    .optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const updateTransferSchema = Joi.object({
  weight: Joi.number().positive().optional(),
  unit: Joi.string().valid("QTL", "MT").optional(),
}).or("weight", "unit");

export const dispatchTransferSchema = Joi.object({
  weight: Joi.number().positive().optional(),
  unit: Joi.string().valid("QTL", "MT").optional(),
  bagCount: Joi.number().integer().min(1).optional(),
});

export const receiveTransferSchema = Joi.object({
  receivedWeight: Joi.number().positive().required(),
  receivedUnit: Joi.string().valid("QTL", "MT").optional(),
  receivedBagCount: Joi.number().integer().min(0).required(),
});

export const returnBagsToFarmerSchema = Joi.object({
  farmerId: Joi.string().uuid().required(),
  goniTypeId: Joi.string().uuid().required(),
  bagCount: Joi.number().integer().min(1).required(),
  notes: Joi.string().max(500).optional(),
});

export const adminReturnBagsToVendorSchema = Joi.object({
  goniTypeId: Joi.string().uuid().required(),
  bagCount: Joi.number().integer().min(1).required(),
  notes: Joi.string().max(500).optional(),
});

export const adminOpeningBagsToVendorSchema = Joi.object({
  goniTypeId: Joi.string().uuid().required(),
  bagCount: Joi.number().integer().min(1).required(),
  notes: Joi.string().max(500).optional(),
});

export const vendorAddOwnBagsSchema = Joi.object({
  goniTypeId: Joi.string().uuid().required(),
  bagCount: Joi.number().integer().min(1).required(),
  notes: Joi.string().max(500).optional(),
});
