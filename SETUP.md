# LuxeMatch — AT Jewellers Platform · Setup & Testing Guide

> **What this is:** An AI-powered jewellery e-commerce platform for AT Jewellers — a single seller with multiple branches. Customers browse, search by photo, try jewellery on via AR camera, add to cart, and checkout. Staff manage inventory and analytics from the same device via a PIN-locked back-office.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Running the System](#running-the-system)
5. [Testing the Full Flow](#testing-the-full-flow)
6. [All Pages Reference](#all-pages-reference)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Demo Credentials](#demo-credentials)
9. [What Is Dummy vs Real](#what-is-dummy-vs-real)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 20 | v22 recommended |
| pnpm | >= 10 | `npm install -g pnpm` |
| Python | >= 3.10 | For the OpenCLIP embedder only |

Cloud services already configured in `.env.local`:
- **Supabase** — Postgres database + Realtime
- **Qdrant Cloud** — Vector search (512-d cosine)
- **Cloudinary** — Product image hosting

---

## Environment Setup

The `.env.local` file in `apps/web/` already contains all working keys for the AT Jewellers dev project. **Do not commit this file.**

```
apps/web/.env.local   ← real credentials, git-ignored
```

Key variables:

| Variable | Purpose |
|---|---|
| `SHOP_JEWELLER_ID` | AT Jewellers UUID — every query is scoped to this |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; used server-side only |
| `NEXT_PUBLIC_SUPABASE_*` | Browser-safe Supabase keys (anon) |
| `LM_PIN_COOKIE_SECRET` | Signs both staff PIN cookie and customer session cookie |
| `QDRANT_*` | Vector DB connection |
| `CLOUDINARY_*` | Asset hosting |
| `EMBEDDER_URL` | Local OpenCLIP service (`http://localhost:8001`) |

---

## Database Migration

The e-commerce layer requires **one manual migration** run in the Supabase dashboard.

### Step 1 — Run the SQL migration

1. Open **https://supabase.com/dashboard** → Your project
2. Go to **SQL Editor** → New query
3. Paste the full content of [`supabase/migrations/0002_ecommerce.sql`](supabase/migrations/0002_ecommerce.sql)
4. Click **Run**

This creates 8 new tables:
`branches` · `customers` · `customer_addresses` · `customer_otps` · `cart_items` · `orders` · `order_items` · `order_status_history`

### Step 2 — Seed demo data

```bash
node scripts/run-migration.mjs
```

This seeds:
- **4 branches**: Connaught Place (Delhi), Bandra West (Mumbai), MI Road (Jaipur), Anna Nagar (Chennai)
- **3 demo customers**: Priya Sharma, Anjali Mehta, Kavita Singh
- **2 demo orders**: one delivered, one in-transit (with full tracking history)

---

## Running the System

### Minimal (no AI search)

```bash
pnpm install
pnpm dev
```

Opens at **http://localhost:3000**. Catalog, AR try-on, cart, checkout, and orders all work without the embedder.

### Full stack (with AI image search)

You need three processes running simultaneously:

```bash
# Terminal 1 — Python OpenCLIP embedder
cd apps/embedder
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn embedder:app --port 8001
# First boot downloads ~350 MB of model weights

# Terminal 2 — Next.js dev server
pnpm dev

# Terminal 3 — (optional) Reindex products into Qdrant
pnpm reindex --jeweller-id=00000000-0000-0000-0000-00000000d3e1
```

### Useful commands

```bash
pnpm dev                   # Start Next.js on :3000
pnpm typecheck             # TypeScript check (all 11 packages)
pnpm build                 # Production build
pnpm lint                  # ESLint
pnpm format                # Prettier write

node scripts/run-migration.mjs   # Seed branches + demo data
pnpm reindex --all               # Reindex all products into Qdrant
```

---

## Testing the Full Flow

### Customer Flow (end-to-end)

#### 1. Browse the catalog

```
http://localhost:3000/catalog
```

- Products load from real Supabase data (not mock)
- Filter by category, metal, price, occasion, AR availability
- Sort by price or newest

#### 2. Open a product detail

Click any product. You will see:
- Real images from Cloudinary
- **Add to Cart** and **Buy Now** buttons
- **Try On** button (needs camera permission)
- Save + Compare buttons

#### 3. Login / Create account

```
http://localhost:3000/login
```

- Enter any 10-digit phone number (e.g. `9876543210`)
- Click **Get OTP**
- The OTP appears in an amber box on the same screen (demo mode — no real SMS)
- Enter the OTP → you are logged in

#### 4. Add to cart

- Go back to any product page
- Click **Add to Cart**
- The cart icon in the header shows a count badge

#### 5. View cart

```
http://localhost:3000/cart
```

- Adjust quantities with +/−
- See the discount hint: use code `LUXE10` at checkout for 10% off

#### 6. Checkout

```
http://localhost:3000/checkout
```

Steps to test:
1. Choose **Home Delivery** or **Click & Collect**
2. If Home Delivery: fill in an address (any values work)
3. Choose a payment method:
   - **Debit/Credit Card** → shows dummy card fields
   - **UPI** → shows a dummy UPI field
   - **Cash on Delivery** → no fields needed
4. (Optional) Enter discount code: `LUXE10`
5. Click **Pay ₹X,XXX**
6. You are redirected to the success page with an order number

#### 7. Order confirmation

```
http://localhost:3000/checkout/success?order=ATJ-YYYYMMDD-XXXX
```

Shows order number and a mini status timeline. Click **Track Order**.

#### 8. Order tracking

```
http://localhost:3000/orders
http://localhost:3000/orders/[order-id]
```

- Full timeline: Placed → Confirmed → Packed → Shipped → Delivered
- Each step shows a timestamp and note
- Payment details and delivery address summary

#### 9. Account page

```
http://localhost:3000/account
```

- Shows your name and phone
- Link to order history
- Sign out

---

### Staff / Back-office Flow

#### Unlock the dashboard

```
http://localhost:3000/jeweller/unlock
```

- Enter PIN: **`123456`** (dev PIN)
- Access granted for 4 hours

#### Dashboard

```
http://localhost:3000/jeweller/dashboard
```

- Business snapshot: views, sales, products, try-ons
- Inventory Decision Brief (AI-powered recommendations)
- Auto-refreshes when another device updates inventory (Supabase Realtime)

#### Analytics

```
http://localhost:3000/jeweller/analytics
```

- Daily activity chart (searches + try-ons)
- Sales by metal and category
- **Conversion Funnel**: views → try-ons → sales with conversion %

#### Intelligence (Inventory AI)

```
http://localhost:3000/jeweller/intelligence
```

- Demand signals per product
- Recommendations: restock, review price, trending up, stalled interest
- Season readiness (wedding season, festive season, gift season)

#### Products

```
http://localhost:3000/jeweller/products
http://localhost:3000/jeweller/products/new
http://localhost:3000/jeweller/products/[id]
```

- View, create, edit products
- Upload images via Cloudinary
- Configure AR try-on assets

---

### AR Try-On Flow

```
http://localhost:3000/try-on
```

1. Allow camera permission when prompted
2. Models download from MediaPipe CDN (~first load only)
3. Hold your hand in front of camera for ring/bangle
4. Look at camera for earrings/necklace
5. The jewellery overlay tracks in real time

**3D models (GLB/GLTF):** Renderer auto-detects `.glb`/`.gltf` URLs and loads them with lighting. PNG assets continue to work as before.

---

### AI Image Search

```
http://localhost:3000/search/image
```

Requires the Python embedder running on `:8001`.

1. Upload a photo of any jewellery
2. OpenCLIP embeds it into a 512-d vector
3. Qdrant finds visually similar products from the catalog
4. Results show with similarity scores

---

## All Pages Reference

### Customer pages

| Page | URL | Description |
|---|---|---|
| Home | `/` | Landing page |
| Catalog | `/catalog` | Browse all products with filters |
| Product detail | `/catalog/[slug]` | Full product page with cart buttons |
| Collections | `/collections` | Curated product bundles |
| Try-on | `/try-on` | AR camera experience |
| Search | `/search` | Text search |
| Image search | `/search/image` | Photo-to-product search |
| Compare | `/compare` | Side-by-side product comparison |
| Saved | `/saved` | Wishlist |
| **Login** | `/login` | Phone OTP authentication |
| **Cart** | `/cart` | Shopping cart |
| **Checkout** | `/checkout` | Address + payment |
| **Order success** | `/checkout/success` | Post-purchase confirmation |
| **Orders** | `/orders` | Order history |
| **Order tracking** | `/orders/[id]` | Live order status timeline |
| **Account** | `/account` | Profile + logout |

### Staff pages (PIN required)

| Page | URL | Description |
|---|---|---|
| Unlock | `/jeweller/unlock` | PIN entry |
| Dashboard | `/jeweller/dashboard` | Business snapshot + AI brief |
| Analytics | `/jeweller/analytics` | Charts, funnel, sales breakdown |
| Intelligence | `/jeweller/intelligence` | Demand signals + recommendations |
| Products | `/jeweller/products` | Product list |
| New product | `/jeweller/products/new` | Add product |
| Edit product | `/jeweller/products/[id]` | Edit + manage images |
| Onboarding | `/jeweller/onboarding` | First-time setup |
| Settings | `/jeweller/settings` | Shop settings |

---

## API Endpoints Reference

All routes mount under `/api`.

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List products (with filters) |
| GET | `/api/products/:slug` | Single product |
| GET | `/api/categories` | All categories |
| GET | `/api/collections` | All collections |
| GET | `/api/search/suggest?q=` | FTS autocomplete |
| POST | `/api/search/text` | Vector text search |
| POST | `/api/search/image` | Vector image search |
| POST | `/api/search/hybrid` | Text + image hybrid search |
| GET | `/api/shop` | Shop public info |
| GET | `/api/customer/cart` | Cart (empty if not logged in) |
| GET | `/api/customer/branches` | Pickup branch list |

### Customer auth

| Method | Path | Body |
|---|---|---|
| POST | `/api/customer/send-otp` | `{ phone }` → returns `demo_otp` |
| POST | `/api/customer/verify-otp` | `{ phone, otp, name? }` → sets cookie |
| GET | `/api/customer/me` | Current session |
| POST | `/api/customer/logout` | Clears cookie |

### Customer (cookie required)

| Method | Path | Description |
|---|---|---|
| POST | `/api/customer/cart` | Add item `{ product_id, quantity }` |
| PATCH | `/api/customer/cart/:productId` | Update quantity |
| DELETE | `/api/customer/cart/:productId` | Remove item |
| DELETE | `/api/customer/cart` | Clear cart |
| POST | `/api/customer/checkout` | Place order |
| GET | `/api/customer/orders` | Order history |
| GET | `/api/customer/orders/:id` | Order detail + tracking |

### Staff (PIN cookie required)

| Method | Path | Description |
|---|---|---|
| POST | `/api/shop/pin/verify` | Unlock (returns PIN cookie) |
| POST | `/api/products` | Create product |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/intelligence/sales` | Record a sale |
| GET | `/api/intelligence/summary` | Dashboard summary |
| GET | `/api/intelligence/funnel` | Conversion funnel |
| GET | `/api/intelligence/recommendations` | Full recommendations |

---

## Demo Credentials

### Staff PIN (back-office unlock)
```
PIN: 123456
```
Valid for 4 hours per session.

### Demo Customer Accounts
Pre-seeded customers (use their phone to log in):

| Name | Phone | Notes |
|---|---|---|
| Priya Sharma | `+919876543210` | Has 2 orders (delivered + shipped) |
| Anjali Mehta | `+919876543211` | No orders yet |
| Kavita Singh | `+919876543212` | No orders yet |

### Discount Code
```
LUXE10  →  10% off at checkout
```

### OTP Behavior (Demo Mode)
- OTP is **displayed on screen** in an amber box — no actual SMS is sent
- OTP expires after **10 minutes**
- Any valid 6-digit OTP from the screen will work

---

## What Is Dummy vs Real

| Feature | Status | Notes |
|---|---|---|
| Product catalog | **Real** | Live Supabase data |
| Image search | **Real** | OpenCLIP embedder + Qdrant |
| AR try-on | **Real** | MediaPipe in browser |
| Customer login (OTP) | **Dummy** | OTP shown on screen, no SMS |
| Cart | **Real** | Stored in Supabase |
| Checkout payment | **Dummy** | Always succeeds, no gateway |
| Order creation | **Real** | Stored in Supabase with full history |
| Order tracking | **Real** | DB-driven status timeline |
| Inventory analytics | **Real** | Live from event tables |
| Realtime sync | **Real** | Supabase Realtime channels |
| Staff PIN auth | **Real** | scrypt hash, HMAC-signed cookie |
| Cloudinary images | **Real** | Actual CDN hosting |
| Qdrant vector search | **Real** | Live cloud instance |

### For production, replace:
1. **OTP** → Twilio / MSG91 / AWS SNS (call `createOtp()` then send via SMS)
2. **Payment** → Razorpay (`POST /api/customer/checkout` → call Razorpay Orders API)
3. **PIN auth** → Supabase Auth with role-based access (Phase 12)

---

## Troubleshooting

### Catalog shows no products
The embedder or Supabase connection may be down. Check:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/products?limit=5
```

### "Add to Cart" redirects to login
You are not logged in. Go to `/login`, enter any phone number, use the OTP shown.

### OTP not appearing
The Supabase `customer_otps` table may not exist yet. Run the migration: [`supabase/migrations/0002_ecommerce.sql`](supabase/migrations/0002_ecommerce.sql)

### Cart is empty after login
Make sure you add products AFTER logging in. Guest-cart persistence is not implemented; cart is server-side per customer.

### Image search returns no results
The embedder must be running on `:8001` AND products must be indexed in Qdrant:
```bash
python -m uvicorn embedder:app --port 8001  # in apps/embedder venv
pnpm reindex --jeweller-id=00000000-0000-0000-0000-00000000d3e1
```

### AR try-on not tracking
- Camera permission must be granted in the browser
- MediaPipe model files download on first use (~50 MB) — wait a few seconds
- GPU delegate preferred; falls back to CPU if unavailable

### TypeScript errors after pulling changes
```bash
pnpm install
pnpm typecheck
```

### Next.js stale manifest after config changes
```bash
rm -rf apps/web/.next
pnpm dev
```

### Staff dashboard PIN rejected
Default dev PIN is `123456`. If changed, run `pnpm provision-shop` to set a new one.
