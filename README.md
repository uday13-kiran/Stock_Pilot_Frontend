# Stockpiolet frontend

React + Vite frontend for the existing Stockpiolet FastAPI backend.

## Requirements
- Node.js 20+ and npm
- The existing FastAPI backend running separately

## Run locally
1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` to the backend origin, e.g. `http://localhost:8000`.
3. Install and run:

```bash
npm install
npm run dev
```

4. Open the URL printed by Vite. API requests use the same-origin `/api/v1` path and Vite forwards them to `VITE_API_BASE_URL`, avoiding browser CORS during local development.

## Build / deploy
- `npm run build` creates `dist/`.
- Deploy `dist/` to Vercel. `vercel.json` rewrites client-side routes to `index.html`.
- Configure `VITE_API_BASE_URL` in the deployment environment to the deployed FastAPI origin.
- Production requests go directly to `VITE_API_BASE_URL`; set the backend's `CORS_ORIGINS` / `cors_origin_list` to include the exact deployed frontend origin (scheme + host). The local Vite proxy does not apply to production builds.
- Never put secrets, passwords, database URLs, or long-lived tokens in frontend environment variables.

## Authentication
The backend login contract is `POST /api/v1/auth/login` with email/password and returns a bearer token and role. The app stores the access token in `sessionStorage` and calls `GET /api/v1/auth/me` to hydrate the session. `sessionStorage` is a browser-accessible token store; for higher-security production deployments consider an HttpOnly secure cookie session implemented by the backend.

Public registration is intentionally not offered because backend registration is disabled.

## Architecture
- `src/app`: providers and route composition
- `src/components/layout`: app shell, navigation, header
- `src/components/ui`: reusable primitives
- `src/features`: auth, dashboard, generic resource workspace, sales checkout
- `src/config`: resource and role-aware navigation configuration
- `src/services`: centralized API and auth clients
- `src/styles`: design tokens and global styles

## Important backend workflow notes
The frontend uses the routes found in the supplied FastAPI project. Sale checkout uses `POST /api/v1/sales/checkout`; purchase-order headers and lines use `/purchase-orders/` and `/purchase-order-items/`; purchase receiving is available in the Transactions section and posts `warehouse_id`, received `items` (`product_id` and positive integer `quantity`), and optional `notes` to `POST /api/v1/purchase-orders/{id}/receive`. The backend handles the inventory update, goods receipt, stock movement, and purchase-order status. Manual payments use `POST /api/v1/invoices/{id}/payments`. Stock transfers and return approvals use the existing workflow routes where surfaced. The backend's own documentation flags some transactional workflows for further integration testing; a successful HTTP response is shown as server-confirmed, but the UI does not claim additional guarantees. Forecasts are estimates.

Some resources are read-only for non-admin users, and the UI hides unsupported actions based on the known route-level policies. Backend authorization remains the source of truth and may still reject requests with 403.

## Known integration constraints
- Product category, brand, and unit references use backend IDs; categories and brands may be created by name while units are selected from existing records. Other foreign-key fields use selectors populated from their corresponding API resources.
- Resource create and edit forms are mapped to the supplied backend schemas, including allowed update fields and route-level write permissions. Purchase-order `user_id` is taken from the signed-in profile, and the order date is prefilled. Order lines are created through the separate purchase-order-items resource.
- Payment creation uses the invoice payment workflow endpoint rather than posting to the payments list endpoint. The payment date and status are assigned by the backend.
- No fake/demo records are bundled. KPI cards and tables display only API results. An empty API response stays empty.
