# Backend integration map

Inspected from the supplied `stockpiolet_backend/main.py`, route modules, and role dependencies.

## Authentication
- `POST /api/v1/auth/login` — email/password; returns bearer token and role.
- `GET /api/v1/auth/me` — authenticated profile; frontend uses `role_name` from this response.
- `POST /api/v1/auth/register` is disabled (403), so no public sign-up UI is provided.

## Route families present in backend source
- `/products/`, `/categories/`, `/brands/`, `/units/`
- `/inventory/`, `/inventory/stock-in`, `/inventory/stock-out`, `/inventory/adjust`, `/inventory/transfers`, `/inventory/transactions`
- `/warehouses/`, `/warehouse-users/`
- `/customers/`, `/suppliers/`, `/supplier-products/`
- `/purchase-orders/`, `/purchase-order-items/`, `/goods-receipts/`, `/goods-receipt-items/`
- `/sales/`, `/sale-items/`, `/sales/checkout`, `/sales-returns/`, `/sales-return-items/`
- `/invoices/`, `/invoice-items/`, `/payments/`, `/invoices/{invoice_id}/payments`
- `/stock-transfers/`, `/stock-transfer-items/`, `/stock-adjustments/`
- `/reorder-rules/`, `/demand-forecasts/`, `/purchase-recommendations/`, `/stock-alerts/`, `/notifications/`
- `/reports/inventory-summary`, `/reports/sales-summary`, `/reports/purchase-summary`, `/reports/stock-movements`
- `/planning/stockout-predictions`, `/planning/dead-stock`, `/planning/purchase-recommendations/refresh`, `/planning/demand-forecast/{product_id}`
- `/users/`, `/roles/`, `/audit-logs/`
- Workflow routes include `/purchase-orders/{purchase_order_id}/receive`, `/sales/checkout`, `/stock-transfers/{transfer_id}/items`, `/stock-transfers/{transfer_id}/approve`, `/stock-transfers/{transfer_id}/dispatch`, `/stock-transfers/{transfer_id}/receive`, and `/sales-returns/{return_id}/approve`.

The list above is a route-family inventory, not a guarantee that every route is fully production verified. Consult backend OpenAPI docs for exact schemas and inspect validation errors returned by the running server.

## Route-level role access from `main.py`
- Admin-only routers: users, roles, warehouse-user relationships.
- Products/catalog: inventory manager, purchase manager, sales staff, warehouse staff, finance/billing staff; create/update/deactivate product is separately admin-only in the route implementation.
- Inventory: inventory manager.
- Warehouses: inventory manager, purchase manager, warehouse staff.
- Customers: sales staff, finance/billing staff.
- Suppliers: purchase manager, inventory manager.
- Purchase orders/items: purchase manager, inventory manager.
- Goods receipts/items: purchase manager, inventory manager, warehouse staff.
- Sales/items, invoices/items, returns/items: sales staff, finance/billing staff.
- Payments: finance/billing staff.
- Transfers/items: inventory manager, warehouse staff.
- Stock adjustments and reorder rules: inventory manager (reorder rules also purchase manager).
- Notifications: inventory manager, purchase manager, sales staff, warehouse staff, finance/billing staff.
- Reports router: inventory manager, purchase manager, finance/billing staff.
- Planning router: inventory manager, purchase manager.
- Workflow router: inventory manager, purchase manager, sales staff, warehouse staff, finance/billing staff.

Admin is granted a broad business-role bypass through the backend's `require_roles` helper. Frontend role gating is only a usability layer; server responses remain authoritative.

## Workflow caveats
The backend's own documentation flags integration-test gaps around purchase receipt posting, atomic sale/stock/invoice/payment behavior, return quantity limits, transfer approvals, concurrency, idempotency, and audit completeness. The frontend does not claim guarantees beyond the server response. Confirm these flows with backend integration tests before production billing/stock operations.

## CORS and API connection checklist

The frontend keeps the existing `/api/v1` API contract. During local development, Vite proxies `/api` to the FastAPI server, so browser requests use the Vite origin and do not require a separate local CORS origin for the API calls.

1. Set `VITE_API_PROXY_TARGET=http://127.0.0.1:8000` in the frontend `.env` when the backend runs on that address. The target must be the FastAPI origin only (do not append `/api/v1`).
2. Start FastAPI on the same target address and confirm its routes are mounted under `/api/v1`.
3. For production, set `VITE_API_BASE_URL` to the deployed API origin (without `/api/v1`). The FastAPI CORS allowlist must include the exact deployed frontend origin, including scheme and hostname. Add each production domain and any preview domain that is actually used; do not use `*` with credentialed authentication.
4. Allow the frontend's required methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) and headers (`Authorization`, `Content-Type`). If cookies are used by the backend, configure credentials consistently on both sides.

This frontend-only archive cannot edit the FastAPI CORS middleware or verify the deployed allowlist. A CORS failure in production must be fixed in the backend's CORS configuration using the actual deployed frontend origin.
