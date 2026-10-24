# 🤖 AmbiBites — AI Context Handover & Session Memory
> **Purpose of this Document:** This file preserves the complete conversational context, decisions made, bug fixes, database changes, architectural choices, and pending tasks across sessions (from Claude Sonnet to Gemini to any future AI model or engineer).  
> **Repository:** `ambibites-web` (Ambikapur Food Delivery Platform)  
> **Last Updated:** October 2026

---

## 1. Project Background & Core Requirements

AmbiBites is a hyper-local food delivery web application built exclusively for **Ambikapur, Chhattisgarh, India**.

### Core User Roles:
1. **Customer (`/` and `/order/[id]`):** Browses Ambikapur restaurants, places orders (COD/UPI), tracks delivery live on a map with a 4-digit PIN verification.
2. **Rider (`/rider`):** Radar tab (30s timer + bell sound for new orders), Active Task tab (pickup/drop, live GPS streaming, PIN entry to complete delivery), COD Cash Wallet.
3. **Restaurant Partner (`/partner`):** Kitchen dashboard. Strictly sees orders belonging only to their `restaurant_id`. Menu item & open/closed status management.
4. **Admin (`/admin`):** Platform analytics, restaurant partner KYC approval, rider document verification.

### Tech Stack:
- **Framework:** Next.js 16 (App Router, Turbopack, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL with RLS)
- **Mapping & Tiles:** Leaflet + OpenStreetMap (100% free, zero API key)
- **Email/OTP:** Brevo
- **Storage:** Cloudflare R2

---

## 2. Chronological Conversation & Implementation History

### Phase A: Initial Bug Fixes & Setup (Claude)
- Fixed initial database queries, order statuses, and role verification flows.
- Implemented image compression pipeline (`imageCompression.ts`) to avoid heavy payloads.

### Phase B: Map Tiles & Watermark Fix
- **Problem:** Leaflet was using CartoDB Voyager raster tiles (`cartocdn.com`). CartoDB restricted their free tier, causing an unsightly `"API KEY REQUIRED"` watermark to render all over the map.
- **Fix:** Switched tile provider in `AmbikapurDeliveryMap.tsx` to pure OpenStreetMap (`tile.openstreetmap.org`). Completely free, no API key, no watermark, permanent.

### Phase C: Map GPS Persistence & Server Restart Issue
- **Problem Identified:** Rider GPS coordinates (`riderLat`, `riderLng`) were previously kept in-memory in Next.js RAM. Whenever the server restarted or redeployed, rider coordinates were wiped.
- **Fix:** 
  1. Updated `src/app/api/orders/route.ts` to accept `riderLat` and `riderLng` via `PATCH` and persist them into Supabase.
  2. Created migration script `add_rider_gps_columns.sql`.
  3. **Executed by User:** User ran the SQL query in Supabase SQL Editor:
     ```sql
     ALTER TABLE public.orders
       ADD COLUMN IF NOT EXISTS rider_lat NUMERIC(10, 8),
       ADD COLUMN IF NOT EXISTS rider_lng NUMERIC(10, 8),
       ADD COLUMN IF NOT EXISTS rider_location_updated_at TIMESTAMPTZ;
     ```
     Status: **Verified Success (`Success. No rows returned`)**.

### Phase D: "Fake Loop Direction" Diagnosis (Laptop vs Mobile)
- **User Question:** "Why is the map showing a loop/fake direction animation instead of real tracking?"
- **Diagnosis:** 
  - Laptops and desktop PCs do **not** have dedicated physical GPS chips. When `navigator.geolocation.watchPosition` is called on a laptop, it either gets blocked or returns static city-center coordinates.
  - To allow local laptop development and UI testing, Claude had included a fallback simulation corridor (`ambikapurCorridor` in `rider/page.tsx`) with a *"Simulate Rider Step"* demo button cycling through 6 fixed Ambikapur waypoints.
  - On a real mobile phone (Android/iOS) with GPS enabled, `watchPosition()` streams real hardware coordinates, so no loop occurs.

### Phase E: Model Switch to Gemini & Comprehensive Architecture Analysis
- User switched model from Claude Sonnet to Gemini and requested a clear summary of all prior discussions, how live mobile tracking works, the flowback/fallback mechanisms, multi-rider concurrency, and city boundary restrictions.
- Created `AMBIBITES_ROADMAP_AND_GPS_GUIDE.md` detailing:
  - Phone GPS tracking mechanics.
  - 4-layer fallback mechanism (GPS denial, phone crash recovery via `localStorage`, customer polling resilience).
  - Race condition handling for 2 riders clicking accept at the same instant.
  - Ambikapur 12 KM geofencing using zero-cost Haversine formula.

---

## 3. Detailed Architectural Clarifications & Inquiries Answered

### Q1: Ek sath 2 log order accept karenge toh kisi ek ko hi assign hoga na? Dusre ko kya aayega?
- **Answer:** Yes. Database query must perform an atomic condition:
  ```sql
  UPDATE orders SET rider_id = $rider_id, status = 'rider_assigned'
  WHERE id = $order_id AND rider_id IS NULL;
  ```
- **Result for Winner (1st Rider):** Assigned successfully, switches to "Active Task" screen.
- **Result for Loser (2nd Rider):** API returns `409 Conflict` / `Already accepted`. Radar displays a gentle alert: *"Order already taken by another rider!"* and dismisses the order card from their radar.

### Q2: Jis kitchen ka order hai sirf usi ko dikhega na?
- **Answer:** Yes. The `/partner` dashboard filters orders by `restaurant_id` belonging to the authenticated partner account. Kitchen A never receives or sees Kitchen B's orders.

### Q3: Ambikapur se bahar order na ho, bina Google Maps paid API ke kaise hoga?
- **Answer:** Using **Haversine Geofencing** (Zero API cost).
  - Ambikapur Center (Ghadi Chowk): `23.1200° N, 83.1985° E`.
  - Max Operational Radius: **12 Kilometers**.
  - Customer checkout calculates the straight-line distance between Ambikapur center and the drop address/pin coordinates.
  - If distance > 12 KM, checkout is blocked with an alert: *"AmbiBites currently operates strictly within Ambikapur city limits (Max 12 KM)."*

---

## 4. Current State of the Codebase

| Component / Feature | Implementation File | Status | Notes |
|---|---|---|---|
| **OSM Map & Tile System** | `src/components/AmbikapurDeliveryMap.tsx` | ✅ Done | No API keys needed; clean OSM tiles |
| **Rider GPS Auto-Broadcast** | `src/app/rider/page.tsx` | ✅ Done | Auto `watchPosition`, fallback demo mode |
| **Customer Tracking Map** | `src/app/order/[id]/page.tsx` | ✅ Done | 3s polling, dynamic polyline & bike marker |
| **GPS DB Columns** | `public.orders` table in Supabase | ✅ Done | `rider_lat`, `rider_lng`, `rider_location_updated_at` |
| **Crash Recovery** | `src/app/rider/page.tsx` | ✅ Done | `localStorage.activeDeliveryId` resumes task |
| **PIN Verification** | `src/app/rider/page.tsx` + `/order/[id]` | ✅ Done | 4-digit PIN required before marking delivered |
| **Ambikapur 12km Boundary Lock** | `src/app/page.tsx` / checkout | 🟡 Pending | Needs Haversine check in order placement |
| **Multi-Rider Concurrency Hardening** | `src/app/api/orders/route.ts` | 🟡 Pending | Verify atomic `rider_id IS NULL` check |
| **Mobile Live Testing on HTTPS** | Device verification | 🟡 Pending | Needs ngrok or Vercel deploy for phone GPS SSL |

---

## 5. Immediate Next Steps for the Next AI / Developer

If you are an AI model continuing this conversation:
1. **Do NOT ask the user to re-run the Supabase migration.** The migration has already been executed successfully.
2. **Do NOT confuse the laptop simulation loop with a bug.** Explain that laptop = simulation mode; mobile = real GPS hardware.
3. **Primary Next Task:** Implement Phase 2:
   - Add the **12 KM Ambikapur Geofence check** at checkout (`src/app/page.tsx` or `/api/orders` POST validation).
   - Verify that any delivery coordinate greater than 12 km from `[23.1200, 83.1985]` returns an error message.
4. **Secondary Next Task:** Confirm the atomic update check in `src/app/api/orders/route.ts` PATCH handler when a rider accepts an order, ensuring no race conditions occur.
5. **Final Step:** Assist the user in running a local HTTPS tunnel (e.g. `npx localtunnel` or `ngrok`) or deploying to Vercel so they can test real GPS on an actual smartphone.
