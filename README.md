# Soya-Farmer Backend

Backend API for vendor/admin-driven farmer billing, stock tracking, and stock transfer management.

## Tech Stack
- Runtime: `Node.js`, `TypeScript`
- Framework: `Express`
- Database: `PostgreSQL`
- ORM: `Prisma`
- Auth: `JWT` (Bearer token)
- Validation: `Joi`
- File Uploads: `multer`

## Roles
- `ADMIN`
- `VENDOR`

Role enforcement is done via:
- `authMiddleware` (token + active user check)
- `authorize("ADMIN" | "VENDOR")`

## High-Level Flow
1. Vendor/Admin logs in and gets JWT.
2. Vendor creates and manages farmers + KYC/land/bank data.
3. Vendor creates bill draft, calculates deductions, applies goni, confirms bill.
4. Bill confirmation creates vendor stock entries.
5. Vendor creates transfer requests from available stock.
6. Admin views transfers, can update pending transfer `weight/unit`, and complete transfer (FIFO deduction from vendor stock).
7. Admin pays or rejects farmer bill; payment status is recorded.

## Project Structure
```txt
src/
  app.ts                    # App bootstrap, route mounting
  server.ts                 # HTTP server startup
  config/
    env.ts                  # Env variable mapping
  controllers/
    auth.controller.ts
    farmer.controller.ts
    bill.controller.ts
    billing/billing.controller.ts
    stock.controller.ts
    stockTransfer.controller.ts
    admin/
      deductionMaster.controller.ts
      goniType.controller.ts
  routes/
    auth.routes.ts
    farmer.routes.ts
    bill.routes.ts
    stock.routes.ts
    admin.route.ts
  middleware/
    auth.middleware.ts
    role.middleware.ts
    validateRequest.middleware.ts
    multer.middleware.ts
  validations/
    *.validation.ts
  database/
    prisma.ts
prisma/
  schema.prisma
  migrations/
```

## API Route Map

### Auth (`/api/auth`)
- `POST /vendor-register`
- `POST /login`
- `PUT /vendor/:id` (ADMIN)
- `PATCH /vendor/:id/status` (ADMIN)
- `GET /vendor/list` (ADMIN)
- `GET /vendor/:id` (ADMIN)

### Farmer (`/api/farmer`)
- Farmer CRUD, documents, land, and bank operations (authenticated)

### Billing (`/api/bill`)
- `POST /draft`
- `POST /:billId/deductions/calc`
- `POST /:billId/goni`
- `GET /:billId/preview`
- `POST /:billId/confirm`
- Bill listing/read endpoints

### Stock (Vendor) (`/api/stock`)
- `GET /` vendor stock list
- `GET /summary`
- `GET /:stockId`
- `POST /transfers` create transfer request
- `GET /transfers` vendor transfer list

### Admin (`/api/admin`)
- Farmer payment/rejection
- Deduction master CRUD/toggle
- Goni type create/update/list
- Transfer operations:
  - `GET /transfers`
  - `PUT /transfers/:transferId/update` (update only `weight`, `unit`)
  - `PUT /transfers/:transferId/complete`
- `GET /stock/summary`

## Core Domain Models
From `prisma/schema.prisma`:
- `User` (ADMIN/VENDOR)
- `Farmer`, `FarmerDocument`, `FarmerLand`, `FarmerBank`
- `Bill`, `BillDeduction`, `FarmerPayment`
- `Stock` (AVAILABLE/TRANSFERRED)
- `StockTransfer` (PENDING/COMPLETED/CANCELLED)
- `DeductionMaster`, `DeductionVariable`, `GoniType`

## Setup
1. Install dependencies:
```bash
npm install
```
2. Create `.env`:
```env
PORT=5000
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=your-secret
```
3. Run migrations:
```bash
npx prisma migrate dev
```
4. (Optional) Seed data:
```bash
npm run seed
```
5. Start dev server:
```bash
npm run dev
```

## Scripts
- `npm run dev` - start TS dev server
- `npm run build` - compile TypeScript
- `npm run start` - run migrations + seed + start built app
- `npm run seed` - seed database

## Use Cases
- Vendor onboarding and status control by admin
- Vendor-managed farmer registration + KYC records
- Draft-to-confirm billing with formula/fixed deductions
- Goni weight handling and net payable calculation
- Vendor inventory creation from confirmed bills
- Admin-governed stock transfer lifecycle
- Farmer payment and rejection workflows
