# 🛵 zuppo - Rider Fleet & Hyperlocal Dispatch Master Blueprint
**Document Version:** 1.0.0  
**Created Date:** 18 October 2026  
**Status:** Approved for Execution  
**Project:** zuppo Hyperlocal Food Delivery (`ambibites-web`)  

---

## 📌 Executive Summary
Is document me **zuppo Rider Fleet**, **High-Volume Order Radar**, **Transparent Payout Division**, aur **Rapido-style Zero-Cost Smart In-App Delivery PIN** ka poora end-to-end technical aur business blueprint documented hai. Kal execution ke waqt ye document humari single source of truth rahega.

---

## 🚀 1. High-Volume Dispatch Architecture (10–25 Orders Ek Sath Aane Par)

### Problem Statement:
Ambikapur me lunch (1:00 PM – 3:00 PM) aur dinner (8:00 PM – 10:30 PM) peak rush hours me ek sath 10 se 25 orders aate hain. Single-order sequential dispatch se deliveries delay ho sakti hain.

### Architectural Solution:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PEAK HOUR DISPATCH PIPELINE                          │
│                                                                        │
│   [ 10-25 Active Customer Orders ]                                     │
│                  │                                                     │
│                  ▼                                                     │
│   [ Live Broadcast Radar Engine ] (WebSocket / Supabase Realtime)      │
│                  │                                                     │
│        ┌─────────┴─────────┐                                           │
│        ▼                   ▼                                           │
│  [ Single Delivery ]  [ Smart Route Batching (Dual Drop) ]             │
│   e.g. 1 Pick, 1 Drop  e.g. Same Kitchen (Royal Kitchen)               │
│   Earn: ₹35-₹45        Drop 1: Gandhi Chowk | Drop 2: Ring Road        │
│                        Earn: ₹65 (Extra +₹25 to Rider)                 │
└────────────────────────────────────────────────────────────────────────┘
```

#### A. Live Radar Feed (Open Pool Dispatch):
* Sabhi online riders ke phone me **Live Radar** screen open rahegi.
* Jab naya order aayega:
  * Device par ek distinct **Order Bell / Chime Sound** baje ga.
  * Haptic vibration trigger hogi.
* Har order card par Rider ko transparently dikhega:
  1. **Pickup Location & Distance** (e.g. *The Royal Kitchen • 0.8 km*)
  2. **Customer Drop Area** (e.g. *Kedarpur • 2.2 km*)
  3. **Guaranteed Rider Earning** (e.g. *Earn ₹38.00*)
  4. **Acceptance Timer** (30-second countdown bar)

#### B. First-Come, First-Serve Instant Locking:
* Jaise hi koi Rider **"Accept Task"** tap karega:
  * Database me order `status = 'rider_assigned'` aur `rider_id = rider.id` lock ho jayega.
  * Baaki sabhi riders ki screen se wo order instantly remove ho jayega (no conflicts).

#### C. Smart Batching (Dual Order Multi-Drop):
* Agar do orders same restaurant se hain ya same delivery corridor me hain:
  * Rider ko prompt milega: *"Combo Delivery Opportunity! Add nearby order for +₹25 extra"*.
  * Rider ek hi trip me 2 orders pick karke deliver karega — rider ki hourly kamai badhegi aur customer delivery time bachega.

---

## 💰 2. Financial Division & Payout Mechanics (Paisa Kaise Divide Hoga)

### Sample Benchmark: ₹250.00 Order

```
┌────────────────────────────────────────────────────────┐
│ CUSTOMER TOTAL BILL BREAKDOWN                          │
├────────────────────────────────────────────────────────┤
│ Food Items Subtotal:                      ₹200.00      │
│ Restaurant GST (5%):                      ₹ 10.00      │
│ Delivery Fee:                             ₹ 35.00      │
│ zuppo Platform Convenience Fee:           ₹  5.00      │
├────────────────────────────────────────────────────────┤
│ TOTAL PAID BY CUSTOMER:                   ₹250.00      │
└────────────────────────────────────────────────────────┘
```

### 💸 Three-Way Automated Revenue Division:

#### 1. Restaurant Partner Payout:
* **Formula:** `Food Subtotal - zuppo Commission (10%) + Restaurant GST`
* `₹200 - ₹20 (10% platform cut) + ₹10 GST` = **₹190.00 Net Payout** to Restaurant.

#### 2. Rider Earnings (100% Transparent Upfront Display):
* **Base Trip Pay:** ₹25.00 *(0 to 2.5 km cover)*
* **Distance Surge:** +₹7.00 per km *(2.5 km se aage har kilometer par)*
* **Weather / Peak Surge:** +₹10.00 to ₹15.00 *(barish ya late night rush me)*
* **Customer Tip:** 100% directly to Rider's wallet *(Zero platform commission)*
* 👉 **Typical Rider Payout:** **₹38.00 – ₹55.00 per completed delivery**.

#### 3. zuppo Platform Net Profit:
* `Platform Convenience Fee (₹5) + Restaurant Commission (₹20) - Delivery Subsidy/Buffer`
* 👉 **Net Platform Margin: ₹20.00 – ₹25.00 pure profit per order**.

#### 4. COD (Cash on Delivery) Floating Limit:
* Har rider ka maximum physical cash hold limit: **₹2,000.00**.
* Jab rider ke paas ₹2,000 physical cash ikattha ho jayega, toh app me alert aayega:
  * *"COD Limit Reached. Handover cash to Hub / Admin or settle via UPI to unlock more orders."*
* Isse platform me cash leakage ka zero risk rehta hai.

---

## 🔐 3. Rapido-Style Zero-Cost Smart In-App Delivery PIN

### Why In-App PIN Over SMS OTP?
| Feature | Traditional SMS OTP | zuppo In-App Smart PIN |
| :--- | :--- | :--- |
| **Cost** | ₹0.20 – ₹0.35 per SMS (Hazaron rupaye mahina) | **₹0.00 (Purely Free)** |
| **Delivery Reliability** | DND, network failure, delayed SMS | **100% Instant (In-App)** |
| **Fraud Protection** | Rider can claim "customer didn't get OTP" | **Zero fraud (PIN needed to complete task)** |
| **Customer Control** | Static / One-off SMS | **Dynamic with 1-Click Regenerate** |

### User Journey:
1. **Order Placed:**
   * Customer jaise hi order place karega, system ek random 4-digit PIN generate karega (e.g. `5842`).
2. **Live Tracking Display (`/order/[id]`):**
   * Customer ke tracking screen par ek prominent badge rahega:
     ```
     ┌─────────────────────────────────────────────────────────┐
     │ 🔐 YOUR DELIVERY PIN:   [ 5 ] [ 8 ] [ 4 ] [ 2 ]         │
     │ Share this 4-digit PIN with the delivery partner at     │
     │ your doorstep to safely receive your food package.      │
     │                                                         │
     │ [ 🔄 Regenerate PIN ]                                   │
     └─────────────────────────────────────────────────────────┘
     ```
3. **Regenerate PIN (Optional):**
   * Agar customer kisi security reason se PIN change karna chahta hai, toh `[🔄 Regenerate PIN]` button tap karte hi instant naya PIN generate ho jayega (e.g. `7193`).
4. **Doorstep Handshake:**
   * Rider jab khana lekar pahunchega, rider app me prompt aayega:
     * `Enter Customer's 4-Digit Delivery PIN`.
   * Customer PIN verbally batayega ➔ Rider app me type karega ➔ PIN match hote hi order **"Delivered"** mark hoga aur rider ke wallet me trip earning add ho jayegi!

---

## 📅 4. Implementation Steps for Execution (Kal ke liye)

### Phase 1: Database & Order Schema Updates
* [ ] Update `LiveOrder` interface in `src/app/api/orders/route.ts` to include:
  ```ts
  deliveryPin: string; // 4-digit code e.g. "4829"
  riderEarnings: number; // calculated trip pay
  distanceKm: number;
  ```
* [ ] Add `POST /api/orders/regenerate-pin` endpoint for 1-click in-app PIN refresh.
* [ ] Add PIN verification logic in `PATCH /api/orders` when marking status as `'delivered'`.

### Phase 2: Customer Live Order Tracking Screen (`src/app/order/[id]/page.tsx`)
* [ ] Build modern Light Cream & Warm Vanilla theme (`#FAF7F2`) tracking page.
* [ ] Zomato-style dynamic status stepper:
  * `Placed` ➔ `Preparing` ➔ `Rider Assigned` ➔ `Out for Delivery` ➔ `Delivered`.
* [ ] Bold **In-App Delivery PIN** card with 4-box layout + `[🔄 Regenerate PIN]` action.
* [ ] Live Restaurant details, order items list, and billing breakdown.
* [ ] Direct phone call button to assigned Rider (without exposing personal numbers).

### Phase 3: Rider App Overhaul (`src/app/rider/page.tsx`)
* [ ] **Radar Screen:** Multi-order feed showing available broadcast orders with earnings tag (`Earn ₹38`).
* [ ] Audio notification chime when new order hits radar.
* [ ] 30-Second Acceptance timer bar.
* [ ] In Transit Navigation screen with Google Maps / Ola Maps deep link.
* [ ] **Doorstep Delivery Handshake Modal:**
  * 4-digit PIN input with number pad.
  * Validation feedback ("PIN Verified! ₹40 Trip Pay Credited").
* [ ] Live Daily Ledger:
  * Today's Trips Count
  * Today's Earnings (₹)
  * Cash Held in Pocket (COD)

### Phase 4: Integration & E2E Testing
* [ ] Customer places order on [localhost:3000](http://localhost:3000) ➔ Redirects to `/order/[id]`.
* [ ] Order appears on Restaurant Partner Kitchen POS (`/partner`) ➔ Marked "Ready".
* [ ] Order broadcasts to Rider Radar (`/rider`) ➔ Rider accepts.
* [ ] Rider arrives at doorstep ➔ Asks customer for PIN ➔ Enters PIN ➔ Order marked Delivered!

---

## 📁 Key File Map

| Path | Purpose |
| :--- | :--- |
| `src/app/api/orders/route.ts` | Order creation, dispatch status, PIN verification |
| `src/app/order/[id]/page.tsx` | Customer Live Order Tracker with In-App PIN |
| `src/app/rider/page.tsx` | Rider Radar, Multi-Order Pool, Doorstep PIN Modal |
| `src/app/partner/page.tsx` | Kitchen POS order acceptance |
| `src/app/admin/page.tsx` | Superadmin Fleet & KYC Control Hub |

---

*This document is saved in the repository root as `RIDER_DISPATCH_ROADMAP.md`.*
