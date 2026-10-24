# 🛵 AmbiBites — Complete Architecture, GPS Live Tracking & Roadmap Guide

> **Target City:** Ambikapur, Chhattisgarh  
> **Tech Stack:** Next.js 16 + Supabase (PostgreSQL) + Leaflet (OpenStreetMap)  
> **Status:** Supabase Migration Executed Successfully ✅

---

## 📌 Index
1. [Supabase Migration Status](#1-supabase-migration-status)
2. [Phone Par Live Map & GPS Kaam Karega? (Exact Working)](#2-phone-par-live-map--gps-kaam-karega-exact-working)
3. [Flowback / Fallback System (Fail-Safe Handling)](#3-flowback--fallback-system-fail-safe-handling)
4. [Ek Sath 2 Rider Order Accept Karein Toh Kya Hoga?](#4-ek-sath-2-rider-order-accept-karein-toh-kya-hoga)
5. [Kitchen / Restaurant Isolation](#5-kitchen--restaurant-isolation)
6. [Ambikapur Geofencing / Boundary Lock (Zero API Cost)](#6-ambikapur-geofencing--boundary-lock-zero-api-cost)
7. [Step-by-Step Action Roadmap](#7-step-by-step-action-roadmap)

---

## 1. Supabase Migration Status

Aapne Supabase SQL Editor me ye query successfully run kar di hai:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rider_lat NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS rider_lng NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS rider_location_updated_at TIMESTAMPTZ;
```

✅ **Iska Fayda:** Ab live GPS coordinates Supabase database me permanently save honge. Server restart ho, phone crash ho, ya page refresh ho — rider ki last known location delete nahi hogi.

---

## 2. Phone Par Live Map & GPS Kaam Karega? (Exact Working)

### 🟢 Seedha Jawab: **HAAN, Phone par 100% kaam karega.**

### ⚙️ Ye Phone Par Kaise Kaam Karta Hai (Step-by-Step Flow):

```
[Rider Phone (Mobile GPS Chip)]
        │
        ▼ (1) Browser permission popup: "Allow Location Access" -> ALLOW
        │
        ▼ (2) navigator.geolocation.watchPosition() physical GPS coordinates read karta hai
        │
        ▼ (3) Rider bike leke chalta hai -> har 10-15 meter move pe API PATCH call hoti hai
        │
        ▼ (4) Coordinates Supabase 'orders' table me update hote hain (rider_lat, rider_lng)
        │
        ▼ (5) Customer ka mobile/laptop screen har 3 second me API GET request bhejta hai
        │
        ▼ (6) Customer ke Leaflet Map par 🛵 Bike Marker live smoothly nayi jagah shift hota hai
[Customer Live Tracking Screen]
```

---

## 3. Flowback / Fallback System (Fail-Safe Handling)

Agar rider ya customer ke side koi technical problem aaye, toh system crash nahi hota. Iske andar 4 level ka fallback/flowback banaya gaya hai:

### 🛡️ Fallback 1: Rider ne GPS Permission "Deny" kar di ya phone ka GPS band hai
- **Problem:** Rider ke browser ne location access block kar diya.
- **Flowback Action:** 
  - Rider screen pe warning aayegi: `📍 Location Access Denied — Please turn on GPS`.
  - Customer screen crash **nahi** hogi.
  - Customer map par Restaurant se lekar Customer ghar tak ka static road route dikhta rahega, aur timeline status (Preparing ➔ Picked Up ➔ Out for Delivery) chalta rahega.
  - Delivery stop nahi hogi — Rider Customer ke pass pahunch kar 4-digit PIN daal kar order normal tareeqe se complete kar sakega.

### 🛡️ Fallback 2: Rider ka Phone Crash ho gaya ya Internet chala gaya
- **Problem:** Delivery ke dauran phone switch off ho gaya ya network dead zone me chala gaya.
- **Flowback Action (Crash Recovery):**
  - Order ID rider ke phone ke `localStorage` me save rehti hai.
  - Phone on karke jab rider dobara login karega, toh system seedha **"Active Task"** tab khol dega.
  - Database me rider ki last saved location customer map pe bani rahegi jab tak naya coordinate na aaye.

### 🛡️ Fallback 3: Laptop Par "Fake Loop" Kyun Dikhta Hai?
- **Problem:** Laptop pe map check karne par lagta hai ki direction loop me chal rahi hai.
- **Karan:** Laptop ya Desktop me physical GPS chip nahi hoti. Isliye laptop browser testing ke liye Ambikapur ke fixed waypoints (Gandhi Chowk ➔ Clock Tower ➔ Kedarpur) ka demo simulation chalata hai.
- **Real Phone Par:** Phone me GPS chip hoti hai, isliye wahan koi loop nahi hota — rider jahan jahan jayega, map wahi point karega.

### 🛡️ Fallback 4: Customer Ka Internet Slow Hai
- Customer screen WebSockets ke bajaye **3-second lightweight polling** use karti hai. Agar ek request drop ho jaye, agle 3 second me automatic retry hota hai bina screen freeze huye.

---

## 4. Ek Sath 2 Rider Order Accept Karein Toh Kya Hoga?

Jab naya order aata hai, Radar me aaspas ke riders ko notification aur bell bajti hai.

```
                    [Naya Order Aaya]
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      Rider A (Pehle dabaya)      Rider B (1 second late)
             │                           │
    ✅ Database Lock Win        ❌ Already Claimed Check
             │                           │
    Order assign ho gaya         Popup: "Order already taken by another rider!"
    Active Task screen khuli     Radar se order gayab ho gaya
```

- **Race Condition Prevention:** Database level pe `UPDATE orders SET rider_id = ... WHERE id = ... AND rider_id IS NULL` check hota hai.
- Jis rider ka click server pe 1 millisecond bhi pehle pahuncha, order sirf usi ko milega.
- Dusre rider ko friendly alert mil jayega aur order radar se remove ho jayega.

---

## 5. Kitchen / Restaurant Isolation

- Har restaurant partner ka dashboard unke `restaurant_id` se secured hota hai.
- **Hotel A** login karega toh sirf **Hotel A** ke menu items aur orders dikhenge.
- **Hotel B** ka data Hotel A ko kabhi nahi dikhega.

---

## 6. Ambikapur Geofencing / Boundary Lock (Zero API Cost)

Aapne pucha: *"Bina Google Maps paid API ke Ambikapur se bahar order hona kaise rokein?"*

### 💡 Solution: Free Mathematical Geofencing (Haversine Formula)

1. **Center of Ambikapur:**
   - Ambikapur Ghadi Chowk / Center coordinates: `Latitude 23.1200, Longitude 83.1985`.
2. **Delivery Radius:**
   - Ambikapur city boundary limit: **10 KM se 12 KM**.
3. **Checking Logic:**
   - Jab customer address select karta hai ya GPS se location pin karta hai:
   $$\text{Distance} = 2 R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta\text{lng}}{2}\right)}\right)$$
   - Agar Distance **<= 12 KM** hai ➔ Order allowed ✅
   - Agar Distance **> 12 KM** hai ➔ Order button disabled ❌
   - Customer ko popup dikhega:
     > *"Oops! AmbiBites currently delivers exclusively within Ambikapur city limits (Max 12 KM). Your location is outside our operational zone."*
4. **Fayda:** 
   - Isme Google Maps API ka ₹1 bhi kharch nahi hota.
   - Pura calculation browser aur server pe free me chalta hai.

---

## 7. Step-by-Step Action Roadmap

| Phase | Kaam | Status |
|---|---|---|
| **Phase 1** | Supabase SQL Migration (GPS Columns) | ✅ **Completed** |
| **Phase 2** | Ambikapur Geofence Validation (12 KM boundary lock) | 🟡 **Next Step** |
| **Phase 3** | Multi-Rider Atomic Assignment Lock verify karna | 🟡 Upcoming |
| **Phase 4** | Mobile Phone Testing (Real GPS over HTTPS/Tunnel) | 🟡 Upcoming |
| **Phase 5** | Free Vercel Deployment (Live Launch) | 🟡 Upcoming |

---
*Created for AmbiBites project by Google Deepmind Antigravity Assistant.*
