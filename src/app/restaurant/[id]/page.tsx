"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  MapPin,
  Star,
  Clock,
  ChevronLeft,
  Search,
  ShoppingBag,
  Percent,
  Plus,
  Minus,
  CheckCircle2,
  Share2,
  Heart,
  Info,
  Sparkles,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  isVeg: boolean;
  isBestseller?: boolean;
  rating: number;
  votes: number;
  description: string;
  imageUrl: string;
}

function parseImages(imageUrl: string | undefined): string[] {
  if (!imageUrl) return ["https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg"];
  if (imageUrl.startsWith("[")) {
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [imageUrl];
}

const legacyMap: Record<string, string> = {
  "rest-1": "11111111-1111-1111-1111-111111111111",
  "rest-2": "22222222-2222-2222-2222-222222222222",
  "rest-3": "33333333-3333-3333-3333-333333333333",
  "rest-4": "44444444-4444-4444-4444-444444444444",
  "the-royal-kitchen": "11111111-1111-1111-1111-111111111111",
  "burger-hub": "22222222-2222-2222-2222-222222222222",
  "ambikapur-dosa-plaza": "33333333-3333-3333-3333-333333333333",
  "kolkata-kathi-rolls": "44444444-4444-4444-4444-444444444444",
};

const RESTAURANT_DATA: { [key: string]: any } = {
  "rest-1": {
    name: "The Royal Kitchen",
    cuisine: "North Indian, Mughlai, Biryani, Tandoor",
    area: "Gandhi Chowk, Ambikapur",
    rating: 4.8,
    reviews: 1420,
    deliveryTime: "25-30 min",
    costForTwo: "₹450 for two",
    discount: "20% OFF UPTO ₹100 • Use AMBIKA20",
    bannerUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
    menu: [
      {
        id: "1",
        name: "Special Chicken Dum Biryani (Handi)",
        category: "Biryani Special",
        price: 320,
        originalPrice: 380,
        isVeg: false,
        isBestseller: true,
        rating: 4.8,
        votes: 420,
        description: "Wood-fired slow dum cooked fragrant basmati rice layered with succulent farm fresh chicken, hard boiled egg, saffron & pure ghee.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
      },
      {
        id: "2",
        name: "Paneer Tikka Butter Roll",
        category: "Rolls & Starters",
        price: 120,
        isVeg: true,
        isBestseller: true,
        rating: 4.6,
        votes: 180,
        description: "Charcoal roasted spiced paneer cubes stuffed in flaky butter paratha with tangy pudina chutney.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg",
      },
      {
        id: "3",
        name: "Tandoori Roasted Chicken (Half)",
        category: "Tandoor Starters",
        price: 250,
        originalPrice: 290,
        isVeg: false,
        rating: 4.7,
        votes: 215,
        description: "Tender bone-in chicken marinated 12 hours in Kashmiri spices, clay-oven roasted to perfection.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/tandoori_roasted_chicken.jpg",
      },
      {
        id: "4",
        name: "Ambikapur Royal Veg Thali",
        category: "Main Course Thalis",
        price: 180,
        isVeg: true,
        isBestseller: true,
        rating: 4.5,
        votes: 190,
        description: "Paneer Butter Masala, Dal Tadka, Seasonal Veg, 4 Butter Tawa Rotis, Jeera Rice, Salad, Pickle & Gulab Jamun.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/ambikapur_royal_veg_thali.jpg",
      },
      {
        id: "9",
        name: "Crispy Aloo Tikki Chaat",
        category: "Chaat & Street",
        price: 80,
        isVeg: true,
        rating: 4.4,
        votes: 155,
        description: "Freshly made crispy aloo patty layered with sweetened curd, tamarind chutney and sev.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/crispy_aloo_tikki_chaat.jpg",
      },
      {
        id: "10",
        name: "Fresh Mango Kulfi Thickshake",
        category: "Beverages",
        price: 90,
        isVeg: true,
        rating: 4.9,
        votes: 210,
        description: "Rich blended mango pulp with genuine Ambikapur kulfi rabdi and crushed dry fruits.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/fresh_mango_kulfi_thickshake.jpg",
      },
    ],
  },
  "rest-2": {
    name: "Burger Hub & Cafe",
    cuisine: "Burgers, Fries, Shakes, Wraps",
    area: "Ghadi Chowk, Ambikapur",
    rating: 4.6,
    reviews: 890,
    deliveryTime: "20-25 min",
    costForTwo: "₹300 for two",
    discount: "FLAT ₹50 OFF on orders above ₹249",
    bannerUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/burger_hub.jpg",
    menu: [
      {
        id: "5",
        name: "Double Cheese Crunchy Burger",
        category: "Burgers",
        price: 140,
        originalPrice: 170,
        isVeg: true,
        rating: 4.6,
        votes: 130,
        description: "Crispy herb patty loaded with molten cheddar cheese, pickled jalapeños and secret house dressing.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/double_cheese_burger.jpg",
      },
      {
        id: "6",
        name: "Crispy Peri-Peri Chicken Wings (6 Pcs)",
        category: "Starters",
        price: 210,
        isVeg: false,
        rating: 4.8,
        votes: 95,
        description: "Golden fried juicy chicken wings tossed vigorously in fiery African peri-peri spice dust.",
        imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/peri_peri_chicken_wings.jpg",
      },
    ],
  },
};

export default function RestaurantDetailPage() {
  const params = useParams();
  const restId = (params?.id as string) || "rest-1";
  const [menuLoading, setMenuLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<any>(() => {
    const resolvedId = legacyMap[restId] || restId;
    const base = RESTAURANT_DATA[resolvedId] || RESTAURANT_DATA[restId] || RESTAURANT_DATA["rest-1"];
    return { ...base, menu: [] };
  });
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [isLiked, setIsLiked] = useState(false);

  // Dynamic fetch from Supabase
  useEffect(() => {
    async function loadDynamicRestaurant() {
      try {
        const resolvedId = legacyMap[restId] || restId;
        const [resRes, menuRes] = await Promise.all([
          fetch("/api/restaurants"),
          fetch(`/api/menu?restaurantId=${resolvedId}`),
        ]);
        const resData = await resRes.json();
        const menuData = await menuRes.json();

        if (resData.success && resData.restaurants?.length > 0) {
          const matched = resData.restaurants.find(
            (r: any) =>
              r.id === resolvedId ||
              r.id === restId ||
              r.slug === restId ||
              r.name.toLowerCase().replace(/\s+/g, "-") === restId.toLowerCase()
          ) || resData.restaurants[0];

          if (matched) {
            const rawMenuItems = menuData.items || menuData.menuItems || [];
            let fetchedMenu: MenuItem[] = [];

            if (rawMenuItems.length > 0) {
              fetchedMenu = rawMenuItems.map((m: any) => ({
                id: m.id,
                name: m.name,
                category: m.category || "Main Course",
                price: Number(m.price),
                originalPrice: m.original_price ? Number(m.original_price) : undefined,
                isVeg: Boolean(m.is_veg),
                isBestseller: Boolean(m.is_bestseller),
                rating: Number(m.rating) || 4.8,
                votes: 120,
                description: m.description || "",
                imageUrl: m.image_url || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
              }));
            } else if (RESTAURANT_DATA[restId]?.menu?.length > 0) {
              fetchedMenu = RESTAURANT_DATA[restId].menu;
            } else {
              // Strictly empty menu if no dishes exist for this specific restaurant
              fetchedMenu = [];
            }

            const rawBanner = matched.banner_url || matched.image_url || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg";
            const bannerParsed = parseImages(rawBanner)[0];

            setRestaurant({
              id: matched.id,
              name: matched.name,
              cuisine: matched.cuisine || matched.cuisine_types?.join(", ") || "North Indian, Mughlai, Biryani",
              area: matched.area || matched.address || "Gandhi Chowk, Ambikapur",
              rating: Number(matched.rating) || 4.8,
              reviews: 1420,
              deliveryTime: matched.delivery_time_text || "25-30 min",
              costForTwo: "₹400 for two",
              discount: "20% OFF UPTO ₹100 • Use AMBIKA20",
              bannerUrl: bannerParsed,
              menu: fetchedMenu,
            });
          }
        }
      } catch (err) {
        console.warn("Using fallback restaurant data:", err);
      } finally {
        setMenuLoading(false);
      }
    }
    loadDynamicRestaurant();
  }, [restId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ambibites_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setCart(parsed);
        }
      }
    } catch {}
  }, []);

  const categories = ["All", ...Array.from(new Set(restaurant.menu.map((m: MenuItem) => m.category))) as string[]];

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      let nextCart = { ...prev };
      if (next <= 0) {
        delete nextCart[id];
      } else {
        nextCart[id] = next;
      }
      try {
        if (Object.keys(nextCart).length === 0) {
          localStorage.removeItem("ambibites_cart");
        } else {
          localStorage.setItem("ambibites_cart", JSON.stringify(nextCart));
        }
      } catch {}
      return nextCart;
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = restaurant.menu.find((m: MenuItem) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const filteredMenu = activeCategory === "All"
    ? restaurant.menu
    : restaurant.menu.filter((m: MenuItem) => m.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased pb-28">
      
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">
              {restaurant.name}
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold">{restaurant.area}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
          <Link
            href="/"
            className="bg-orange-600 text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-600/20"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{totalItems} Items</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* Restaurant Card Header */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Verified Ambikapur Kitchen
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  FSSAI Approved
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{restaurant.name}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">{restaurant.cuisine}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-slate-600 font-semibold">
                <span className="flex items-center gap-1 bg-emerald-600 text-white font-black px-2 py-0.5 rounded-md text-[11px]">
                  ★ {restaurant.rating}
                </span>
                <span>({restaurant.reviews} Ambikapur ratings)</span>
                <span>•</span>
                <span>{restaurant.costForTwo}</span>
              </div>
            </div>

            {/* Delivery Stats Box */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center gap-4 self-start">
              <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Estimated Delivery</span>
                <span className="text-sm font-black text-slate-900">{restaurant.deliveryTime}</span>
              </div>
            </div>
          </div>

          {/* Deals banner */}
          <div className="mt-4 flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 p-3 rounded-2xl border border-orange-200/60 text-xs font-bold text-orange-800">
            <Percent className="w-4 h-4 text-orange-600" />
            <span>Offer: <strong>{restaurant.discount}</strong></span>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none sticky top-16 bg-[#f8fafc]/95 backdrop-blur-md py-2 z-30">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-black transition shadow-xs whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-slate-900 text-white scale-105"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dishes List */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-slate-900">
            {activeCategory === "All" ? "Full Menu Selection" : activeCategory} ({filteredMenu.length})
          </h3>

          {menuLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((n) => (
                <div key={n} className="bg-white p-4 rounded-3xl border border-slate-200 animate-pulse h-36 flex justify-between">
                  <div className="space-y-2.5 flex-1 pr-4">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                  </div>
                  <div className="w-28 h-24 bg-slate-200 rounded-2xl shrink-0" />
                </div>
              ))}
            </div>
          ) : filteredMenu.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No dishes available in this category</p>
              <p className="text-xs text-slate-400">Add dishes to this kitchen via Partner POS.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMenu.map((dish: MenuItem) => {
              const qty = cart[dish.id] || 0;
              return (
                <div
                  key={dish.id}
                  className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition flex justify-between gap-4"
                >
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Veg / Non veg marker */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${
                            dish.isVeg ? "border-emerald-600" : "border-rose-600"
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${dish.isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
                        </div>
                        {dish.isBestseller && (
                          <span className="text-[10px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                            Bestseller
                          </span>
                        )}
                      </div>

                      <Link href={`/product/${dish.id}`} className="group">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-orange-600 transition leading-snug">
                          {dish.name}
                        </h4>
                      </Link>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-black text-slate-900">₹{dish.price}</span>
                        {dish.originalPrice && (
                          <span className="text-xs text-slate-400 line-through">₹{dish.originalPrice}</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {dish.description}
                      </p>
                    </div>

                    <Link
                      href={`/product/${dish.id}`}
                      className="text-[11px] font-bold text-orange-600 hover:underline mt-2 inline-block"
                    >
                      View Recipe Details & Add-ons →
                    </Link>
                  </div>

                  {/* Photo & Add Button Column */}
                  <div className="flex flex-col items-center justify-between w-28 shrink-0">
                    <Link href={`/product/${dish.id}`} className="w-28 h-24 rounded-2xl overflow-hidden bg-slate-100 shadow-inner block">
                      <img
                        src={parseImages(dish.imageUrl)[0]}
                        alt={dish.name}
                        className="w-full h-full object-cover hover:scale-105 transition duration-300"
                      />
                    </Link>

                    <div className="w-full mt-2">
                      {qty > 0 ? (
                        <div className="flex items-center justify-between bg-orange-50 border border-orange-300 px-2 py-1 rounded-xl shadow-xs">
                          <button
                            onClick={() => updateQuantity(dish.id, -1)}
                            className="text-orange-600 hover:bg-orange-100 rounded p-0.5"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-black text-orange-700 text-xs">{qty}</span>
                          <button
                            onClick={() => updateQuantity(dish.id, 1)}
                            className="text-orange-600 hover:bg-orange-100 rounded p-0.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateQuantity(dish.id, 1)}
                          className="w-full bg-white border-2 border-orange-500 hover:bg-orange-600 hover:text-white text-orange-600 font-black text-xs py-1.5 rounded-xl transition shadow-xs"
                        >
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

      </main>

      {/* Floating Bottom Bar when items added */}
      {totalItems > 0 && (
        <div className="fixed bottom-5 left-4 right-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4">
          <Link
            href="/?openCart=true"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-4 px-6 rounded-3xl shadow-2xl flex items-center justify-between transition"
          >
            <div>
              <span className="text-xs uppercase opacity-80 block">Order Total</span>
              <span className="text-base font-black">{totalItems} items • ₹{totalAmount}</span>
            </div>
            <span className="text-xs font-black bg-white text-orange-600 px-4 py-2 rounded-xl shadow">
              Proceed to Checkout →
            </span>
          </Link>
        </div>
      )}

    </div>
  );
}
