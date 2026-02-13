## Billing & Deduction Flow

The backend now supports a multi-step billing pipeline without weigh slips. Bills store a single quantity (QTL or MT), the negotiated rate, computed gross, goni deductions, and the final net payable amount.

### Core APIs (`/api/bill`)
1. `POST /draft` – create a DRAFT bill for a `{ farmerId }`.
2. `POST /:billId/quantity` – capture `{ quantity, unit, rate }`, computing `grossAmount`.
3. `POST /:billId/deductions/calc` – supply deduction master ids with runtime inputs. The formula engine evaluates each and persists resolved amounts.
4. `POST /:billId/goni` – choose a goni type and bag count to auto-calc `goniWeight`.
5. `GET /:billId/preview` – return the bill with farmer, deductions, goni info, and totals.
6. `POST /:billId/confirm` – final validation that locks the bill in `PENDING` status.

### Admin Management (`/api/admin`)
- `POST /deductions` / `PUT /deductions/:masterId` – CRUD for deduction masters (FIXED or FORMULA) with optional variable definitions.
- `PATCH /deductions/:masterId/toggle` – activate/deactivate a master.
- `GET /deductions` – list masters with variables.
- `POST /goni-types`, `PUT /goni-types/:goniTypeId`, `GET /goni-types` – manage bag metadata used for goni deductions.

### Schema Changes
- `QuantityUnit` now only supports `QTL` or `MT`.
- `Bill` includes `primaryQuantity`, `primaryUnit`, `ratePerUnit`, `grossAmount`, `goniWeight`, `netPayable`, and optional `goniTypeId`.
- New master tables: `DeductionMaster`, `DeductionVariable`, `GoniType`.
- Legacy `BillWeight` and `WeighSlip` tables are removed.

### Formula Engine
`src/services/formulaEngine.service.ts` wraps `expr-eval` to safely process expressions such as `moisture * dagi * mati`. Inputs are validated per master-defined variables before evaluation, ensuring consistent and debuggable deductions.

### Getting Started
```bash
npm install
npx prisma generate
npm run dev
```
Prerequisites: configure your database connection in `.env` before running migrations.
