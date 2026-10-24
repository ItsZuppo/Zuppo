# 🍔 AmbiBites — Ambikapur Hyperlocal Food Delivery Ecosystem

> **Built for Ambikapur City Limits** • System Architecture v2  
> High-performance food delivery platform featuring Customer Ordering, Restaurant Partner POS, Rider Fleet Management, and Master Admin Control.

---

## 🌟 Ecosystem Overview

AmbiBites is designed as a unified, role-based food delivery architecture:

| Portal | Route | Description |
| :--- | :--- | :--- |
| **Customer Web App** | `/` | Browse local Ambikapur eateries, circular food craving filters, real-time checkout basket with COD & UPI options. |
| **Restaurant Menu Page** | `/restaurant/[id]` | Dedicated restaurant page with verified hygiene tags, delivery estimates, discounts, and categorized menu. |
| **Product / Dish Detail** | `/product/[id]` | Detailed dish view with spice level selection (`Medium`/`Spicy`/`Extra Spicy`), optional add-ons, chef's notes, and nutrition breakdown. |
| **Restaurant Partner Hub** | `/partner` | Live kitchen POS with loud ring alerts, 3-minute accept/reject timer, "Mark Ready for Rider", and live menu stock toggles. |
| **Admin Control Center** | `/admin` | Dark command dashboard with live dispatch queue, restaurant on/off toggles, and weekly payout calculations. |
| **Rider Fleet App** | `/rider` | Mobile-first rider view with waypoint timelines, map navigation, order progression, and COD cash debt tracking. |

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) with PostCSS
- **Database & Backend:** [Supabase](https://supabase.com/) (Serverless PostgreSQL + RLS + Realtime)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** TypeScript & React 19

---

## 📐 Key Architectural Rules (Blueprint Compliant)

1. **The "Price Lock" Rule:**
   - Order line-items store `price_at_order` statically in the `order_items` table so that subsequent restaurant menu price revisions never corrupt historical receipts.
2. **The COD Reverse-Ledger Loop:**
   - Riders collecting physical Cash on Delivery have their digital ledger incremented.
   - If cash held exceeds **₹2,000**, the system locks them out from receiving new COD orders until physical cash is handed over to Admin.
3. **Database Integrity & RLS (Row-Level Security):**
   - **Gate 1 (Customers):** Customers can read and create only their own orders.
   - **Gate 2 (Riders):** Riders see customer details strictly while delivery is active.
   - **Gate 3 (Admin):** Master key access to monitor entire Ambikapur operations.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/xMIRCHIx/Ambibite.git
cd Ambibite
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Fill in your Supabase project keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Database Setup (Supabase)
1. Go to your Supabase Project **SQL Editor**.
2. Run the SQL script located at [`supabase/schema.sql`](./supabase/schema.sql).
3. This creates all tables (`profiles`, `restaurants`, `menu_items`, `orders`, `order_items`, `rider_ledger`), RLS policies, and seeds local Ambikapur restaurants.

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment (Vercel)

1. Import this repository into [Vercel](https://vercel.com).
2. Add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Hit **Deploy** — your platform will be live in under 2 minutes.

---

## 📄 License
Private repository for AmbiBites Ambikapur Operations.
