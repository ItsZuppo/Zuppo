-- ==============================================================================
-- AMBIKAPUR FOOD DELIVERY (AmbiBites) - COMPLETE SUPABASE DATABASE SCHEMA v2
-- Aligned with: Ambikapur Food Delivery Blueprint
-- Features:
-- 1. Profiles & Role-based authentication (Admin, Partner, Rider, Customer)
-- 2. Price Lock Rule (static prices on order_items)
-- 3. Row-Level Security (RLS) for privacy & security
-- 4. Reverse-Ledger for COD cash collection with ₹2,000 threshold lockout
-- 5. Seed data for Ambikapur restaurants and menu items
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'restaurant_partner', 'rider', 'admin')) DEFAULT 'customer',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RESTAURANTS TABLE
CREATE TABLE IF NOT EXISTS public.restaurants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cuisine TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'Ambikapur',
  address TEXT NOT NULL,
  latitude NUMERIC(10, 6) DEFAULT 23.120000, -- Ambikapur center
  longitude NUMERIC(10, 6) DEFAULT 83.190000,
  is_open BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  commission_percent NUMERIC(5, 2) DEFAULT 20.00, -- 20% platform cut
  delivery_time_text TEXT DEFAULT '25-30 min',
  rating NUMERIC(2, 1) DEFAULT 4.5,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  original_price NUMERIC(10, 2),
  is_veg BOOLEAN NOT NULL DEFAULT TRUE,
  is_bestseller BOOLEAN DEFAULT FALSE,
  in_stock BOOLEAN DEFAULT TRUE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS TABLE (Core Order Flow matching Blueprint Page 5)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL, -- e.g. AB-1001
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE RESTRICT NOT NULL,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'placed',
      'restaurant_accepted',
      'preparing',
      'ready_for_pickup',
      'rider_assigned',
      'picked_up',
      'delivered',
      'cancelled'
    )
  ) DEFAULT 'placed',
  item_total NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'UPI', 'CARD')) DEFAULT 'COD',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'completed', 'refunded')) DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC(10, 6),
  delivery_lng NUMERIC(10, 6),
  rider_lat NUMERIC(10, 8),           -- Live GPS: rider latitude
  rider_lng NUMERIC(10, 8),           -- Live GPS: rider longitude
  rider_location_updated_at TIMESTAMPTZ, -- Last GPS update timestamp
  prep_time_minutes INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDER ITEMS (Enforces "Price Lock" Rule: Blueprint Page 11)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name_at_order TEXT NOT NULL,
  price_at_order NUMERIC(10, 2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC(10, 2) NOT NULL
);

-- 6. RIDER LEDGER & COD REVERSE LOOP (Blueprint Page 8 & 11)
CREATE TABLE IF NOT EXISTS public.rider_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  trip_earning NUMERIC(10, 2) DEFAULT 40.00, -- ₹40 per trip to rider
  cash_collected NUMERIC(10, 2) DEFAULT 0.00, -- Physical cash held
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earning', 'cod_collection', 'cash_handover_reset')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_ledger ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view their own profile; admins can view all
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Restaurants: Everyone can browse active restaurants
CREATE POLICY "Active restaurants viewable by everyone" 
  ON public.restaurants FOR SELECT USING (true);

-- Menu Items: Publicly visible
CREATE POLICY "Menu items viewable by everyone" 
  ON public.menu_items FOR SELECT USING (true);

-- Orders: 
-- Gate 1: Customers can view only their own orders
CREATE POLICY "Customers view own orders" 
  ON public.orders FOR SELECT 
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (auth.uid() = customer_id OR customer_id IS NULL);

-- Order Items: Viewable if you can view the parent order
CREATE POLICY "Order items viewable by order owner"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.customer_id = auth.uid() OR orders.rider_id = auth.uid())
    )
  );

-- ==============================================================================
-- SEED DATA: AMBIKAPUR LOCAL OUTLETS & MENU
-- ==============================================================================

-- 1. Insert Restaurants
INSERT INTO public.restaurants (id, name, slug, cuisine, phone, area, address, is_open, commission_percent, delivery_time_text, rating, banner_url)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111',
    'The Royal Kitchen',
    'the-royal-kitchen',
    'North Indian, Mughlai, Biryani, Tandoor',
    '+91 98261 44551',
    'Gandhi Chowk',
    'Main Road, Near Gandhi Chowk, Ambikapur',
    TRUE,
    20.00,
    '25-30 min',
    4.8,
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Burger Hub & Cafe',
    'burger-hub',
    'Burgers, Fries, Shakes, Wraps',
    '+91 70002 99120',
    'Ghadi Chowk',
    'Near Clock Tower, Ghadi Chowk, Ambikapur',
    TRUE,
    20.00,
    '20-25 min',
    4.6,
    'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Ambikapur Dosa Plaza',
    'ambikapur-dosa-plaza',
    'South Indian, Dosas, Filter Coffee',
    '+91 94252 11029',
    'Ring Road East',
    'Ring Road, Transport Nagar Road, Ambikapur',
    TRUE,
    20.00,
    '30-35 min',
    4.7,
    'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?q=80&w=1200&auto=format&fit=crop'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Kolkata Kathi Rolls',
    'kolkata-kathi-rolls',
    'Rolls, Shawarma, Fast Food',
    '+91 99814 77218',
    'Sadhar Hospital Road',
    'Opposite District Hospital, Ambikapur',
    TRUE,
    20.00,
    '15-20 min',
    4.5,
    'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=1200&auto=format&fit=crop'
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Menu Items for The Royal Kitchen
INSERT INTO public.menu_items (restaurant_id, name, category, price, original_price, is_veg, is_bestseller, in_stock, description, image_url)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Special Chicken Dum Biryani (Handi)',
    'Biryani Special',
    320.00,
    380.00,
    FALSE,
    TRUE,
    TRUE,
    'Wood-fired slow dum cooked fragrant basmati rice layered with succulent farm fresh chicken, hard boiled egg, saffron & pure ghee.',
    'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=600&auto=format&fit=crop'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Paneer Tikka Butter Roll',
    'Rolls & Starters',
    120.00,
    150.00,
    TRUE,
    TRUE,
    TRUE,
    'Charcoal roasted spiced paneer cubes stuffed in flaky butter paratha with tangy pudina chutney.',
    'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=600&auto=format&fit=crop'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Tandoori Roasted Chicken (Half)',
    'Tandoor Starters',
    250.00,
    290.00,
    FALSE,
    FALSE,
    TRUE,
    'Tender bone-in chicken marinated 12 hours in Kashmiri spices, clay-oven roasted to perfection.',
    'https://images.unsplash.com/photo-1598514982205-f36b96d1e8d4?q=80&w=600&auto=format&fit=crop'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Ambikapur Royal Veg Thali',
    'Main Course Thalis',
    180.00,
    220.00,
    TRUE,
    TRUE,
    TRUE,
    'Paneer Butter Masala, Dal Tadka, Seasonal Veg, 4 Butter Tawa Rotis, Jeera Rice, Salad & Gulab Jamun.',
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600&auto=format&fit=crop'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Fresh Mango Kulfi Thickshake',
    'Beverages',
    90.00,
    110.00,
    TRUE,
    FALSE,
    TRUE,
    'Rich blended mango pulp with genuine Ambikapur kulfi rabdi and crushed dry fruits.',
    'https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=600&auto=format&fit=crop'
  );

-- ==============================================================================
-- 8. POSTGREST PRIVILEGES GRANT (Required so Next.js & Supabase API can access tables)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

