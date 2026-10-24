# 🗺️ AmbiBites — Product Roadmap & Architecture Plan

> **Location:** Ambikapur, Chhattisgarh  
> **Mission:** Hyperlocal, Zero-Egress Food Delivery Ecosystem (Customer, Partner Kitchen, Rider Fleet, Admin)  
> **Status:** Active Development (October 2026)

---

## 📌 1. Completed Milestones (Production-Ready)

- [x] **Zero-Egress Media Pipeline (Cloudflare R2):**
  - Integrated S3-compatible Cloudflare R2 bucket with custom public CDN domain (`pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev`).
  - Automated image uploads for restaurant banners and food dishes (single & multi-image carousel support).
- [x] **Supabase Serverless PostgreSQL Integration:**
  - Live persistence of restaurants, categories, dishes, and orders.
  - Resolved dynamic UUID linking across legacy identifiers (`rest-1` $\to$ UUIDs).
- [x] **Partner Kitchen POS & Menu Hub (`/partner`):**
  - Live incoming orders queue with 4-second auto-poll.
  - Multi-image photo carousel upload for food items.
  - Dynamic food categories with live counts.
  - Custom category creation (e.g. *Momos*, *Chinese*, *Chai*, *Pastas*).
  - Custom variants/add-ons builder (e.g. *Extra Cheese +₹40*, *Large Size +₹80*).
  - Live stock toggler (● In Stock / ○ Sold Out) and full dish Edit/Delete.
  - Kitchen profile management (banner image, open/close status, preparation times).

---

## 🔒 2. Security & Role Isolation Architecture (Zero-Trust Principle)

### ⚠️ The Problem: Client-Side Tampering & "Inspect Element" Vulnerability
If the frontend sends an unverified `restaurantId` or `userId` in API payloads, a malicious user or competitor can:
1. Open Chrome DevTools / Inspect Element or Postman / curl.
2. Edit or send another kitchen's `restaurantId`.
3. Modify dishes, alter prices, or cancel/hijack another restaurant's live orders.

### 🛡️ The Architecture: Server-Side Enforcement (Zero Trust Frontend)
No sensitive operation relies on client-provided IDs. All authority comes from the **Server-Side Session**:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Request                            │
│  (Contains HttpOnly Session Cookie or Supabase Auth JWT Bearer) │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Middleware                      │
│ 1. Decodes and verifies User Session cryptographically          │
│ 2. Extracts authenticated user's Role & Bound Entity:           │
│    - Role = 'restaurant_partner' ──> Binds to Owned Kitchen ID │
│    - Role = 'rider'              ──> Binds to Rider ID          │
│    - Role = 'customer'           ──> Binds to Customer ID       │
│    - Role = 'admin'              ──> Master Citywide Access     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Execution (RLS)                     │
│ Even if frontend injects another restaurant's ID, the server    │
│ ignores it or throws 403 Forbidden because session doesn't match!│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 3. Sprint Breakdown & Upcoming Milestones

### 🔐 Sprint 1: Unified Auth & Role-Based Access Control (Next Priority)
- [ ] **Multi-Role Login Portal (`/login`):**
  - Customer login (OTP / Phone authentication).
  - Restaurant Partner login (Credentials bound strictly to kitchen record).
  - Rider login (Fleet credentials bound to driver profile).
  - Master Admin login.
- [ ] **Session & Route Protection:**
  - Prevent unauthorized users from viewing `/partner`, `/rider`, or `/admin`.
  - Remove DevMode Kitchen Switcher for production; replace with logged-in partner's dedicated kitchen dashboard.
- [ ] **Server-Side Authorization Gates:**
  - Secure `/api/menu` (POST/PATCH/DELETE): verify partner owns `restaurant_id`.
  - Secure `/api/orders` (PATCH): verify partner or assigned rider can transition states.

---

### 🍕 Sprint 2: Customer Customization Modal (Zomato-Style)
- [ ] **Interactive Add-On Sheet (`/restaurant/[id]` & `/`):**
  - When customer clicks **ADD** on an item with custom variants (e.g. *Double Cheese Pizza*), open animated bottom sheet.
  - Allow picking size (Half/Full) and add-ons (*Extra Cheese +₹40*, *Mayo Dip +₹20*).
  - Calculate dynamic total and add exact variant payload into cart.

---

### 🔔 Sprint 3: Kitchen POS Live Audio Alert & Auto-Accept Timer
- [ ] **Live Audio Chime:**
  - Audio alert ("Ting! Naya Order Aaya") when a new order lands in `/partner`.
- [ ] **Countdown Accept Timer:**
  - 180-second visual countdown to accept incoming orders before auto-escalation.

---

### 🛵 Sprint 4: Live Order Tracking (`/order/[id]`)
- [ ] **Customer Order Status Stepper:**
  - 1. Order Placed $\to$ 2. Kitchen Preparing $\to$ 3. Rider Assigned $\to$ 4. Out for Delivery in Ambikapur $\to$ 5. Delivered.
- [ ] **Delivery Verification:**
  - OTP verification upon physical delivery.

---

### 🏪 Sprint 5: Restaurant Onboarding & Admin Payouts
- [ ] **"+ Add New Restaurant" Self-Serve Flow:**
  - Allow onboarding new Ambikapur kitchens directly through the portal with approval workflow.
- [ ] **Rider COD Cash-Collection Ledger:**
  - Daily cash settlement with ₹2,000 lockout threshold.
