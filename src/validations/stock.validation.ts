import Joi from "joi";

// =====================
// TRANSFER VALIDATIONS
// =====================
export const createTransferSchema = Joi.object({
  weight: Joi.number().positive().optional(),
  unit: Joi.string().valid("QTL", "MT").optional(),
  bagCount: Joi.number().integer().min(1).optional(),
  goniTypeId: Joi.string().uuid().optional(),
  thappiIds: Joi.array().items(Joi.string().uuid()).min(1).optional(),
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
})
  .custom((value, helpers) => {
  const hasItems = Array.isArray(value.items) && value.items.length > 0;
  const hasSingleGoni = !!value.goniTypeId;
  const hasSingleBagCount = typeof value.bagCount === "number";
  const hasSingle = hasSingleGoni && hasSingleBagCount;
  const hasThappis = Array.isArray(value.thappiIds) && value.thappiIds.length > 0;

  if (hasSingleGoni !== hasSingleBagCount) {
    return helpers.error("any.custom", {
      customMessage: "Both goniTypeId and bagCount are required together",
    });
  }

  if (!hasItems && !hasSingle && !hasThappis) {
    return helpers.error("any.custom", {
      customMessage:
        "Provide thappiIds[] or items[] or goniTypeId + bagCount",
    });
  }

  if (value.sourceLocationId === value.destinationLocationId) {
    return helpers.error("any.custom", {
      customMessage: "Source and destination locations must be different",
    });
  }

  return value;
}, "transfer item validation")
  .messages({
    "any.custom": "{{#customMessage}}",
  });

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
  dispatchLatitude: Joi.number().min(-90).max(90).required(),
  dispatchLongitude: Joi.number().min(-180).max(180).required(),
  dispatchLocationText: Joi.string().trim().max(255).required(),
});

export const receiveTransferSchema = Joi.object({
  receivedWeight: Joi.number().positive().required(),
  receivedUnit: Joi.string().valid("QTL", "MT").optional(),
  receivedBagCount: Joi.number().integer().min(0).required(),
  receiveLatitude: Joi.number().min(-90).max(90).required(),
  receiveLongitude: Joi.number().min(-180).max(180).required(),
  receiveLocationText: Joi.string().trim().max(255).required(),
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
