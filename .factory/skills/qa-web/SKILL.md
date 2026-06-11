---
name: qa-web
description: >
  QA tests for the Zentro web app. Tests POS flows, organization management,
  auth, products, customers, sales, settings, and shifts. Uses browser-harness for
  interactive web testing against the local dev server.
---

# Zentro Web QA Skill

## App Notes

- Framework: Vike + React (CSR)
- Auth: better-auth with email/password. Organization roles: owner, admin, member.
- Database: PostgreSQL (Docker: `docker compose up -d`; migrations: `bun run db:migrate`)
- Data sync: Rocicorp Zero (`zero-cache` on port 4848; app callbacks on `:3000/api/zero/*`)
- UI: shadcn/radix with Tailwind CSS, dark theme (#0f0f0f background)
- Language: Spanish UI (es-CO)
- API: Zero queries/mutators via `/api/zero/*`; REST auxiliares (`/api/dashboard/*`, `/api/organization/join-link-preview`, `/api/qz/*`)
- Dev server: `bun run dev` → `http://localhost:3000`
- E2E canónico: Playwright en `tests/e2e/` (`bun run e2e:playwright`)

## Testing Target

This project uses a **local dev server** strategy:

1. Start Postgres (and optionally zero-cache): `docker compose up -d`
2. Start the dev server: `bun run dev` in the background
3. If zero-cache is not running in Docker, start `bun run zero:dev` in another terminal
4. Poll `http://localhost:3000` until it responds (timeout: 60s)
5. Use `http://localhost:3000` as the base URL for all browser tests

If the dev server cannot start, report ALL web tests as BLOCKED: "Dev server failed to start -- cannot verify branch code."

## Authentication Method

Email/password via better-auth. The login page is at `/login`.

- To log in: fill email input (placeholder: "tu@negocio.com…"), fill password input, click "Ingresar"
- To register: toggle to "Registrarse", fill name (optional), email, password (min 8 chars), confirm password, click "Crear cuenta"
- After login/register, the app redirects to `/dashboard` automatically
- Join links: `/login?token=<token>` will show a join card after login

## Persona Test Accounts

QA creates accounts dynamically during each run. Use these email patterns:
- Owner: `qa+owner_{RUN_ID}@example.com`
- Admin: `qa+admin_{RUN_ID}@example.com`
- Member: `qa+member_{RUN_ID}@example.com`
- New user: `qa+signup_{RUN_ID}@example.com`

Password for all test accounts: use a strong consistent password (e.g., `QATestPassword123!`)

## Available Test Flows

### 1. Auth Flows

#### 1a. Signup
1. Navigate to `/login`
2. Click "Registrarse" tab
3. Fill name, email, password (>= 8 chars), confirm password
4. Submit
5. Expect redirect to `/dashboard`
6. Expect organization selection screen (first-time user)

#### 1b. Login
1. Navigate to `/login`
2. Click "Iniciar sesión" tab
3. Fill existing test account email and password
4. Submit
5. Expect redirect to `/dashboard` or `/organization` if no active org

#### 1c. Join Organization via Link
1. Generate a join link as owner/admin via organization settings
2. Copy the join URL
3. Open join URL in an incognito session (or sign out first)
4. Sign up or log in
5. Expect auto-join to organization and redirect to `/dashboard`

### 2. Organization Management Flows

#### 2a. Create Organization
1. As a new user after signup, on the organization selection screen
2. Click to create a new organization
3. Fill organization name and slug
4. Submit
5. Expect redirect to `/dashboard` with the new org active

#### 2b. Invite Member (Owner/Admin only)
1. Navigate to `/organization`
2. Click "Invitaciones" tab
3. Fill email and select role
4. Click "Enviar Invitación"
5. Expect success message "Invitación enviada."
6. Verify invitation appears in pending list

#### 2c. Manage Members (Owner/Admin only)
1. Navigate to `/organization`
2. Click "Miembros" tab
3. Verify member list displays
4. For a non-owner member, click edit role
5. Change role and save
6. Expect success message "Rol actualizado."

#### 2d. Create Join Link (Owner/Admin only)
1. Navigate to `/organization`
2. Click "Acceso" tab
3. Fill optional label and expiry
4. Click "Crear Link"
5. Expect success message and URL copied

#### 2e. Negative: Member cannot manage access
1. Log in as a member persona
2. Navigate to `/organization`
3. Go to "Invitaciones" or "Acceso" tabs
4. Expect "Acceso restringido" alert instead of action forms

### 3. POS Flows

#### 3a. Open Shift
1. Navigate to `/pos`
2. If no active shift, click "Abrir turno" (or the shift button in header)
3. Fill starting cash amount
4. Submit
5. Expect POS grid to become active

#### 3b. Browse Products and Add to Cart
1. With an active shift, on `/pos`
2. Click a category tab or search for a product
3. Click a product card
4. If modifiers modal appears, select modifiers or click quick add
5. Verify cart panel shows the item with correct quantity

#### 3c. Checkout Sale
1. With items in cart
2. Click "Cobrar" (Checkout)
3. In checkout modal, add payment method(s)
4. Verify total amounts match
5. Click "Finalizar"
6. Expect success and cart clears

#### 3d. Close Shift
1. Navigate to `/pos`
2. Click "Cerrar turno"
3. Verify summary amounts
4. Fill closure amounts
5. Submit
6. Expect success and shift closed

#### 3e. Cash Movement
1. With active shift on `/pos`
2. Click "Movimiento de caja"
3. Select type (inflow/expense/payout), amount, description
4. Submit
5. Expect success confirmation

### 4. Product & Category Flows

#### 4a. Create Product
1. Navigate to `/products`
2. Click "Nuevo producto"
3. Fill name, price, category, stock, barcode, etc.
4. Submit
5. Expect product to appear in list

#### 4b. Edit Product
1. On `/products`
2. Click edit on a product
3. Change a field (e.g., price)
4. Submit
5. Expect updated value in list

#### 4c. Search Products
1. On `/products`
2. Type in search box
3. Expect filtered results

### 5. Customer Flows

#### 5a. Create Customer
1. Navigate to `/customers`
2. Click "Nuevo cliente"
3. Fill name, phone, document type/number
4. Submit
5. Expect customer in list

#### 5b. Search Customers
1. On `/customers`
2. Type in search box
3. Expect filtered results

### 6. Sales & Reporting Flows

#### 6a. View Sales History
1. Navigate to `/sales`
2. Verify sales list loads
3. Click a sale for detail view
4. Expect sale details (items, payments, totals)

### 7. Settings Flows

#### 7a. Update Settings
1. Navigate to `/settings`
2. Change a setting (e.g., payment methods, terminal name)
3. Submit
4. Expect success confirmation

### 8. Credit Flows

#### 8a. Credit Account Overview
1. Navigate to `/credit`
2. Verify credit accounts list loads
3. Click an account for transactions

### 9. Shift Management Flows

#### 9a. View Shifts
1. Navigate to `/shifts`
2. Verify shift history list loads
3. Click a shift for detail

### 10. Kitchen Display Flows

#### 10a. Kitchen View
1. Navigate to `/kitchen`
2. Verify kitchen ticket display loads
3. Confirm a pending order changes status

## Known Failure Modes

1. **Dev server startup delay.** `bun run dev` may take 10-20 seconds to be ready on first run. Poll with retry every 2s up to 60s.
2. **Zero not connected.** Without zero-cache on `:4848`, org-scoped data will not sync. Ensure `docker compose up -d` or `bun run zero:dev` is running.
3. **No active organization.** Users without an active organization may be redirected to `/organization` instead of `/dashboard`. Ensure organization is created and set active before testing POS or other org-scoped features.
4. **Shift required for POS.** The POS page blocks product selection and checkout when no shift is open. Always open a shift first.
5. **Spanish locale assumptions.** UI text is in Spanish (e.g., "Iniciar sesión", "Registrarse", "Cobrar"). Do not assume English labels.
6. **Mobile drawer behavior.** On mobile viewports, the cart is inside a drawer. Open it via the floating cart button before verifying cart contents.
