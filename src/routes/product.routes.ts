import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import * as productController from "../controllers/product.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  createProductSchema,
  updateProductSchema,
} from "../validations/product.validation";

const router = Router();

router.post(
  "/",
  validateRequest(createProductSchema),
  authMiddleware,
  authorize("ADMIN"),
  productController.createProduct,
);
router.get("/", authMiddleware, productController.getProducts);
router.get(
  "/admin",
  authMiddleware,
  authorize("ADMIN"),
  productController.getProductsAdmin,
);
router.get("/:id", authMiddleware, productController.getProductById);
router.put(
  "/:id",
  validateRequest(updateProductSchema),
  authMiddleware,
  authorize("ADMIN"),
  productController.updateProduct,
);
router.patch(
  "/:id",
  authMiddleware,
  authorize("ADMIN"),
  productController.disableEnableProduct,
);

export default router;
