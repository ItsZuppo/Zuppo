"use client";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";

import BrandLogo from "@/components/BrandLogo";
import ZomatoLocationModal from "@/components/ZomatoLocationModal";
import type { HomeBanner, HomeSettings } from "@/lib/homeSettings";
import { HomeAnnouncement, RestaurantHero, useHomeSettings } from "@/components/HomePromotions";
import { isServiceable } from "@/lib/delivery";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  Search,
  ChevronDown,
  ShoppingBag,
  X,
  Minus,
  Plus,
  Compass,
  Star,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Banknote,
  Sparkles,
  Percent,
  SlidersHorizontal,
  Flame,
  Bike,
  Store,
  ChevronRight,
  ChevronLeft,
  Heart,
  UserRound,
} from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
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

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviews: number;
  deliveryTime: string;
  distance: string;
  area: string;
  discount: string;
  imageUrl: string;
  isOpen: boolean;
}

const RESTAURANTS: Restaurant[] = [
  {
    id: "rest-1",
    name: "The Royal Kitchen",
    cuisine: "North Indian, Mughlai, Biryani",
    rating: 4.8,
    reviews: 1420,
    deliveryTime: "25-30 min",
    distance: "1.8 km",
    area: "Gandhi Chowk",
    discount: "20% OFF UPTO ₹100",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
    isOpen: true,
  },
  {
    id: "rest-2",
    name: "Burger Hub & Cafe",
    cuisine: "Burgers, Fries, Shakes, Wraps",
    rating: 4.6,
    reviews: 890,
    deliveryTime: "20-25 min",
    distance: "2.3 km",
    area: "Ghadi Chowk",
    discount: "FLAT ₹50 OFF",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/burger_hub.jpg",
    isOpen: true,
  },
  {
    id: "rest-3",
    name: "Ambikapur Dosa Plaza",
    cuisine: "South Indian, Dosas, Filter Coffee",
    rating: 4.7,
    reviews: 630,
    deliveryTime: "30-35 min",
    distance: "3.1 km",
    area: "Ring Road East",
    discount: "ITEMS AT ₹99",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/dosa_plaza.jpg",
    isOpen: true,
  },
  {
    id: "rest-4",
    name: "Kolkata Kathi Rolls",
    cuisine: "Rolls, Shawarma, Fast Food",
    rating: 4.5,
    reviews: 512,
    deliveryTime: "15-20 min",
    distance: "1.2 km",
    area: "Sadhar Hospital Road",
    discount: "FREE DELIVERY",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/kolkata_kathi_rolls.jpg",
    isOpen: true,
  },
];

const DEFAULT_CATEGORIES = [
  { name: "Biryani", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg" },
  { name: "Rolls & Wraps", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500&auto=format&fit=crop&q=80" },
  { name: "Burgers", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/double_cheese_burger.jpg" },
  { name: "Thali Meals", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/ambikapur_royal_veg_thali.jpg" },
  { name: "Pizzas", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/1791717968463_694_image_SM654Q_1764739219.jpg" },
  { name: "Chaat & Street", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/crispy_aloo_tikki_chaat.jpg" },
  { name: "Dosas", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/mysore_masala_butter_dosa.jpg" },
  { name: "Shakes & Chai", image: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/fresh_mango_kulfi_thickshake.jpg" },
];

const MENU_ITEMS: MenuItem[] = [
  {
    id: "1",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Special Chicken Dum Biryani (Handi)",
    category: "Biryani",
    price: 320,
    originalPrice: 380,
    isVeg: false,
    isBestseller: true,
    rating: 4.8,
    votes: 420,
    description: "Slow wood-fired dum cooked aromatic basmati with tender marinated chicken pieces, egg and saffron ghee.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
  },
  {
    id: "2",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Paneer Tikka Butter Roll",
    category: "Rolls & Wraps",
    price: 120,
    isVeg: true,
    isBestseller: true,
    rating: 4.6,
    votes: 180,
    description: "Tandoori grilled cottage cheese cubes wrapped in fresh butter layered paratha with spiced onion salsa.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg",
  },
  {
    id: "3",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Tandoori Roasted Chicken (Half)",
    category: "Non-Veg Starters",
    price: 250,
    originalPrice: 290,
    isVeg: false,
    rating: 4.7,
    votes: 215,
    description: "Classic tender bone-in chicken slow roasted in coal oven with Kashmiri degi mirch & hung curd.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/tandoori_roasted_chicken.jpg",
  },
  {
    id: "4",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Ambikapur Royal Veg Thali",
    category: "Thali Meals",
    price: 180,
    isVeg: true,
    isBestseller: true,
    rating: 4.5,
    votes: 190,
    description: "Deluxe wholesome thali with Paneer Butter Masala, Dal Tadka, Seasonal Sabzi, 4 Tawa Rotis, Jeera Rice, Salad & Sweet.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/ambikapur_royal_veg_thali.jpg",
  },
  {
    id: "5",
    restaurantId: "rest-2",
    restaurantName: "Burger Hub",
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
    restaurantId: "rest-2",
    restaurantName: "Burger Hub",
    name: "Crispy Peri-Peri Chicken Wings (6 Pcs)",
    category: "Burgers",
    price: 210,
    isVeg: false,
    rating: 4.8,
    votes: 95,
    description: "Golden fried juicy chicken wings tossed vigorously in fiery African peri-peri spice dust.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/peri_peri_chicken_wings.jpg",
  },
  {
    id: "7",
    restaurantId: "rest-3",
    restaurantName: "Ambikapur Dosa Plaza",
    name: "Mysore Masala Butter Dosa",
    category: "Dosas",
    price: 130,
    isVeg: true,
    isBestseller: true,
    rating: 4.9,
    votes: 310,
    description: "Crispy golden fermented crepe smeared with red chilli garlic paste, filled with spiced potato mash. Served with 3 chutneys & sambar.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/mysore_masala_butter_dosa.jpg",
  },
  {
    id: "8",
    restaurantId: "rest-4",
    restaurantName: "Kolkata Kathi Rolls",
    name: "Double Egg Chicken Roll",
    category: "Rolls & Wraps",
    price: 150,
    isVeg: false,
    rating: 4.7,
    votes: 280,
    description: "Fresh paratha layered with twin beaten eggs, stuffed with juicy charred chicken tikkas, lemon & crunchy onions.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/double_egg_chicken_roll.jpg",
  },
  {
    id: "9",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Crispy Aloo Tikki Chaat",
    category: "Chaat & Street",
    price: 80,
    isVeg: true,
    rating: 4.4,
    votes: 155,
    description: "Hot crisp potato cakes bathed in thick spiced curd, tangy saunth, spicy coriander chutney and sev.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/crispy_aloo_tikki_chaat.jpg",
  },
  {
    id: "10",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    name: "Fresh Mango Kulfi Thickshake",
    category: "Shakes & Chai",
    price: 90,
    isVeg: true,
    rating: 4.9,
    votes: 210,
    description: "Rich blended mango shake infused with cardamom kulfi chunks and roasted almonds.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/fresh_mango_kulfi_thickshake.jpg",
  },
];

function parseImages(imageUrl: string | undefined): string[] {
  if (!imageUrl) return ["https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/1.jpg"];
  if (imageUrl.startsWith("[")) {
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [imageUrl];
}

function FoodItemCard({
  item,
  qtyInCart,
  onUpdateQty,
}: {
  item: MenuItem;
  qtyInCart: number;
  onUpdateQty: (delta: number) => void;
}) {
  const images = parseImages(item.imageUrl);
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 flex flex-col justify-between group">
      <div>
        {/* Image Carousel Container */}
        <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-3.5 bg-slate-100 shadow-inner group/carousel">
          <Link href={`/product/${item.id}`} className="w-full h-full block">
            <img
              src={images[activeIdx] || images[0]}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
            />
          </Link>

          {/* Carousel Arrows if multiple images */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition shadow z-10 cursor-pointer"
                title="Previous photo"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition shadow z-10 cursor-pointer"
                title="Next photo"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Dots */}
              <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1 z-10 pointer-events-none">
                {images.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === activeIdx ? "w-4 bg-orange-500 shadow" : "w-1.5 bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Veg / Non-veg marker */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md p-1.5 rounded-lg shadow-md pointer-events-none z-10">
            <div
              className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${
                item.isVeg ? "border-emerald-600" : "border-rose-600"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                }`}
              />
            </div>
          </div>

          {/* Bestseller Badge */}
          {item.isBestseller && (
            <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 z-10 pointer-events-none">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Bestseller</span>
            </div>
          )}

          {/* Rating pill */}
          <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shadow z-10 pointer-events-none">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>{item.rating}</span>
            <span className="text-slate-300">({item.votes})</span>
          </div>
        </div>

        {/* Restaurant Origin */}
        <Link href={`/restaurant/${item.restaurantId}`} className="text-[11px] font-extrabold text-orange-600 uppercase tracking-wider hover:underline block">
          {item.restaurantName}
        </Link>

        {/* Item Name & Details */}
        <Link href={`/product/${item.id}`}>
          <h3 className="font-bold text-base text-slate-900 group-hover:text-orange-600 transition leading-snug mt-0.5">
            {item.name}
          </h3>
        </Link>

        <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-medium leading-relaxed">
          {item.description}
        </p>
      </div>

      {/* Price & Cart Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black text-slate-900">₹{item.price}</span>
            {item.originalPrice && (
              <span className="text-xs text-slate-400 line-through font-semibold">
                ₹{item.originalPrice}
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block">
            Ambikapur Fresh
          </span>
        </div>

        {qtyInCart > 0 ? (
          <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-300 px-2.5 py-1 rounded-xl shadow-xs">
            <button
              onClick={() => onUpdateQty(-1)}
              className="w-6 h-6 rounded-lg bg-white text-orange-600 font-bold hover:bg-orange-100 flex items-center justify-center transition shadow-xs"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-extrabold text-orange-700 text-sm w-4 text-center">
              {qtyInCart}
            </span>
            <button
              onClick={() => onUpdateQty(1)}
              className="w-6 h-6 rounded-lg bg-orange-600 text-white font-bold hover:bg-orange-700 flex items-center justify-center transition shadow-xs"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onUpdateQty(1)}
            className="bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-600 hover:text-white font-black text-xs px-5 py-2 rounded-xl transition shadow-xs active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomerHome({ initialProfile, initialPromotions }: { initialPromotions: {settings:HomeSettings;banners:HomeBanner[]} | null; initialProfile: {name:string; avatarUrl:string;phone:string;addresses:{id:string;label:string;address:string;lat:number;lng:number}[];defaultAddressId:string} | null }) {
  const [account, setAccount] = useState<{name:string; avatarUrl:string} | null>(initialProfile);
  const [savedAddresses, setSavedAddresses] = useState<{id:string;label:string;address:string;lat:number;lng:number}[]>(initialProfile?.addresses || []);
  useEffect(() => {
    fetch("/api/account", {cache:"no-store"}).then(r=>r.json()).then(data=>{
      if (!data.success) {setAccount(null);setSavedAddresses([]);return;}
      const p=data.profile;setAccount({name:p.name,avatarUrl:p.avatarUrl});setCustomerName(p.name);setCustomerPhone(p.phone);setSavedAddresses(p.addresses);
      const selected=p.addresses.find((a:{id:string})=>a.id===p.defaultAddressId);
      if(selected){setSelectedLocation(selected.label+", Ambikapur");setAddressDetails(selected.address);setDeliveryCoords({lat:selected.lat,lng:selected.lng});}
    }).catch(()=>{});
  }, []);
  const homeSettings = useHomeSettings(initialPromotions);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"COD" | "UPI">("COD");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState<any>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [customerName, setCustomerName] = useState(initialProfile?.name || "");
  const [customerPhone, setCustomerPhone] = useState(initialProfile?.phone || "");
  const [selectedLocation, setSelectedLocation] = useState("Gandhi Chowk, Ambikapur");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number; lng: number} | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const useCurrentLocation = () => {
    if (!navigator.geolocation || !window.isSecureContext) { setLocationMessage("Location needs HTTPS or localhost. Select your delivery area instead."); return; }
    setLocationMessage("Finding your location...");
    navigator.geolocation.getCurrentPosition(pos => {
      const {latitude: lat, longitude: lng} = pos.coords;
      if (!isServiceable(lat, lng)) { setDeliveryCoords(null); setLocationMessage("Your location is outside our 12 km delivery area."); return; }
      setDeliveryCoords({lat, lng});
      setSelectedLocation(`Delivery pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setLocationMessage("Delivery pin saved. Please provide your house number and landmark at checkout.");
    }, err => setLocationMessage(err.code === 1 ? "Location is blocked. Open browser site settings, allow Location, then try again." : "Could not get a GPS fix. Turn on device Location and retry."), {enableHighAccuracy: true, timeout: 15000});
  };
  const [addressDetails, setAddressDetails] = useState("");

  // Restore cart from localStorage on mount & listen to URL triggers
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ambibites_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          setCart(parsed);
        }
      }
    } catch {}

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openCart") === "true") {
        setIsCartOpen(true);
      }
    }
  }, []);

  // Sync cart changes to localStorage
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

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      alert("Cart is empty! Please add items to order.");
      return;
    }
    setIsPlacingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim() || "Ambikapur Customer",
          customerPhone: customerPhone.trim() || "+91 98261 44551",
          deliveryArea: selectedLocation,
          addressDetails,
          ...(deliveryCoords ? { deliveryLat: deliveryCoords.lat, deliveryLng: deliveryCoords.lng } : {}),
          restaurantName: cartItems[0]?.restaurantName || "The Royal Kitchen",
          items: cartItems.map((i) => ({
            id: i.id,
            name: i.name,
            qty: i.qty,
            price: i.price,
            isVeg: i.isVeg,
          })),
          itemTotal,
          deliveryFee,
          platformFee,
          totalAmount: grandTotal,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        setPlacedOrderDetails(data.order);
        setOrderPlaced(true);
        setCart({});
        try { localStorage.removeItem("ambibites_cart"); } catch {}
      } else {
        if (res.status === 401) window.location.assign("/login?role=customer");
        alert(data.error || "Order could not be saved. Your cart has been kept.");
      }
    } catch {
      alert("Connection failed. Your cart has been kept. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const [restaurants, setRestaurants] = useState<Restaurant[]>(RESTAURANTS);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // Live fetch from Supabase
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch((err) => console.warn("Live categories fetch notice:", err));

    fetch("/api/restaurants")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.restaurants && data.restaurants.length > 0) {
          const mapped: Restaurant[] = data.restaurants.map((r: any) => ({
            id: r.slug || r.id,
            name: r.name,
            cuisine: r.cuisine,
            rating: Number(r.rating || 4.5),
            reviews: 420,
            deliveryTime: r.delivery_time_text || "25-30 min",
            distance: "1.8 km",
            area: r.area,
            discount: `${r.commission_percent || 20}% OFF`,
            imageUrl: r.banner_url || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
            isOpen: r.is_open && !r.is_blocked,
          }));
          setRestaurants(mapped);
        }
      })
      .catch((err) => console.warn("Live restaurants notice:", err));

    fetch("/api/menu")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.menuItems && data.menuItems.length > 0) {
          const mapped: MenuItem[] = data.menuItems.map((m: any, idx: number) => ({
            id: m.id || String(idx + 1),
            restaurantId: m.restaurant_id,
            restaurantName: m.restaurants?.name || "Ambikapur Kitchen",
            name: m.name,
            category: m.category,
            price: Number(m.price),
            originalPrice: m.original_price ? Number(m.original_price) : undefined,
            isVeg: m.is_veg,
            isBestseller: m.is_bestseller,
            rating: 4.8,
            votes: 180,
            description: m.description,
            imageUrl: m.image_url || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
          }));
          setMenuItems(mapped);
        }
      })
      .catch((err) => console.warn("Live menu notice:", err));
  }, []);

  const filteredItems = menuItems.filter((item) => {
    if (selectedFilter !== "All") {
      const filterLower = selectedFilter.toLowerCase();
      const itemCatLower = (item.category || "").toLowerCase();
      const itemNameLower = (item.name || "").toLowerCase();

      const matches =
        itemCatLower === filterLower ||
        itemCatLower.includes(filterLower) ||
        filterLower.includes(itemCatLower) ||
        (filterLower.includes("pizza") && (itemNameLower.includes("pizza") || itemCatLower.includes("pizza"))) ||
        (filterLower.includes("roll") && (itemNameLower.includes("roll") || itemNameLower.includes("wrap") || itemCatLower.includes("roll") || itemCatLower.includes("wrap"))) ||
        (filterLower.includes("burger") && (itemNameLower.includes("burger") || itemNameLower.includes("wings") || itemCatLower.includes("burger"))) ||
        (filterLower.includes("biryani") && (itemNameLower.includes("biryani") || itemCatLower.includes("biryani"))) ||
        (filterLower.includes("dosa") && (itemNameLower.includes("dosa") || itemCatLower.includes("dosa"))) ||
        (filterLower.includes("thali") && (itemNameLower.includes("thali") || itemCatLower.includes("thali"))) ||
        (filterLower.includes("shake") && (itemNameLower.includes("shake") || itemNameLower.includes("chai")));

      if (!matches) return false;
    }
    if (isVegOnly && !item.isVeg) return false;
    if (
      searchQuery &&
      !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.restaurantName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = menuItems.find((m) => m.id === id) || MENU_ITEMS.find((m) => m.id === id);
    return {
      ...(item || {
        id,
        name: "Food Item",
        price: 100,
        isVeg: true,
        restaurantName: "The Royal Kitchen",
        restaurantId: "rest-1",
        category: "Main Course",
        rating: 4.5,
        votes: 100,
        description: "",
        imageUrl: "",
      }),
      qty,
    };
  });

  const itemTotal = cartItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const deliveryFee = itemTotal > 0 ? 20 : 0;
  const platformFee = itemTotal > 0 ? 5 : 0;
  const grandTotal = itemTotal + deliveryFee + platformFee;
  const totalItemCount = cartItems.reduce((acc, item) => acc + item.qty, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased flex flex-col justify-between selection:bg-orange-500 selection:text-white">

      <HomeAnnouncement settings={homeSettings}/>

      {/* Primary Sticky Header */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col gap-2.5">

          {/* Top Row: Brand, Delivery Location, Cart */}
          <div className="flex items-center justify-between gap-2">

            {/* Logo & City Selector */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Link href="/" className="flex items-center gap-2 group shrink-0">
                <BrandLogo size={58} />
              </Link>

              {/* Address Selector Pill (Visible on all screens) */}
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold cursor-pointer border border-slate-200 transition truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs"
              >
                <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span className="truncate">Deliver to: <strong className="text-slate-900">{selectedLocation.split(",")[0]}</strong></span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
            </div>

            {/* Desktop Navigation & Cart Trigger */}
            <div className="flex items-center gap-2 shrink-0">
                      {/* Desktop Search & Veg toggle (Hidden on mobile, mobile has row below) */}
              <div className="hidden md:flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search food or restaurant..."
                    className="pl-9 pr-4 py-2 w-52 lg:w-64 rounded-full bg-slate-100 border border-transparent text-xs font-medium focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition"
                  />
                </div>

                <button
                  onClick={() => setIsVegOnly(!isVegOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition shadow-xs ${
                    isVegOnly
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-500/20"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-xs border flex items-center justify-center p-0.5 ${isVegOnly ? "border-emerald-600" : "border-slate-400"}`}>
                    <span className={`w-full h-full rounded-full ${isVegOnly ? "bg-emerald-600" : "bg-slate-300"}`} />
                  </span>
                  <span>Veg Only</span>
                </button>
              </div>

              {/* Cart Trigger Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-orange-600 hover:bg-orange-700 active:scale-95 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-black text-xs flex items-center gap-1.5 sm:gap-2 shadow-md shadow-orange-600/30 transition shrink-0"
              >
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Cart</span>
                {totalItemCount > 0 ? (
                  <span className="bg-white text-orange-600 rounded-full px-1.5 py-0.2 text-[10px] font-black">
                    {totalItemCount}
                  </span>
                ) : (
                  <span className="xs:hidden text-[11px] font-bold">0</span>
                )}
              </button>
              <Link href={account ? "/account" : "/login"} aria-label={account ? "Open your profile" : "Login"} className="group ml-1 flex w-12 shrink-0 flex-col items-center gap-1 text-stone-700">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-orange-200 bg-orange-50 ring-2 ring-white transition group-hover:border-orange-500 group-hover:bg-orange-100">
                  {account?.avatarUrl ? <img src={account.avatarUrl} alt="" className="h-full w-full rounded-full object-cover"/> : <UserRound className="h-5 w-5 text-orange-600" strokeWidth={1.8}/>}
                </span>
                <span className="text-[10px] font-bold leading-none">{account ? "Profile" : "Login"}</span>
              </Link>
            </div>
          </div>

          {/* Mobile Search Row & Veg Toggle (Visible only on mobile/tablet < 768px) */}
          <div className="flex md:hidden items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food or restaurant in Ambikapur..."
                className="w-full pl-9 pr-3 py-2 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition"
              />
            </div>

            <button
              onClick={() => setIsVegOnly(!isVegOnly)}
              className={`flex items-center gap-1 px-3 py-2 rounded-full border text-xs font-bold transition shrink-0 shadow-xs ${
                isVegOnly
                  ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-1 ring-emerald-500"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              <span className={`w-3 h-3 rounded-xs border flex items-center justify-center p-0.5 ${isVegOnly ? "border-emerald-600" : "border-slate-400"}`}>
                <span className={`w-full h-full rounded-full ${isVegOnly ? "bg-emerald-600" : "bg-slate-300"}`} />
              </span>
              <span className="text-[11px]">Veg</span>
            </button>
          </div>

        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-4 lg:px-8 py-5 sm:py-6 space-y-8 sm:space-y-10 pb-28 md:pb-12">
        <RestaurantHero settings={homeSettings}/>

        {/* 1. What's on your mind? Horizontal Food Category Circles */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                What's on your mind?
              </h2>
              <p className="text-xs text-slate-500 font-medium">Explore handpicked Ambikapur cravings</p>
            </div>
            {selectedFilter !== "All" && (
              <button
                onClick={() => setSelectedFilter("All")}
                className="text-xs font-bold text-orange-600 hover:underline"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-none scroll-smooth">
            {categories.map((cat) => {
              const isActive = selectedFilter === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedFilter(isActive ? "All" : cat.name)}
                  className="flex flex-col items-center gap-2 group shrink-0 transition"
                >
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden p-1 transition duration-300 shadow-md ${isActive ? "ring-4 ring-orange-500 scale-105" : "group-hover:scale-105 group-hover:ring-2 group-hover:ring-orange-300"
                    }`}>
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className={`text-xs font-extrabold transition ${isActive ? "text-orange-600" : "text-slate-700 group-hover:text-orange-600"
                    }`}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Top Restaurant Chains in Ambikapur */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Top Food Outlets in Ambikapur
              </h2>
              <p className="text-xs text-slate-500 font-medium">Handpicked kitchens with highest food hygiene & 4.5+ ratings</p>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-200/60 px-3 py-1 rounded-full">
              {restaurants.length} Kitchens Live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {restaurants.map((rest) => (
              <Link
                key={rest.id}
                href={`/restaurant/${rest.id}`}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Photo with Offer Badge */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={rest.imageUrl}
                      alt={rest.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                    {/* Discount Tag */}
                    <div className="absolute bottom-2.5 left-3">
                      <span className="text-white text-xs font-black tracking-wide drop-shadow-md flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-orange-400" />
                        {rest.discount}
                      </span>
                    </div>

                    {/* Delivery Time Badge */}
                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-slate-800 shadow-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-orange-600" />
                      <span>{rest.deliveryTime}</span>
                    </div>
                  </div>

                  {/* Rest Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-orange-600 transition leading-snug">
                        {rest.name}
                      </h3>
                      <span className="bg-emerald-600 text-white text-[11px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 shadow-xs">
                        ★ {rest.rating}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1 mt-1 font-medium">
                      {rest.cuisine}
                    </p>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                      <MapPin className="w-3 h-3 text-orange-500" />
                      <span>{rest.area}</span>
                      <span>•</span>
                      <span>{rest.distance}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. Infinite Scrolling Food Products Grid */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-600 fill-orange-600" />
                <span>All Dishes Available for Delivery</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Showing {filteredItems.length} fresh options ready to dispatch in Ambikapur
              </p>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {["All", ...categories.map((c) => c.name)].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-xs whitespace-nowrap ${selectedFilter === tab
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Dishes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <FoodItemCard
                key={item.id}
                item={item}
                qtyInCart={cart[item.id] || 0}
                onUpdateQty={(delta) => updateQuantity(item.id, delta)}
              />
            ))}
          </div>
        </section>

      </main>

      {/* Floating Bottom Sticky Cart Bar */}
      {totalItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-5 left-4 right-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 px-6 rounded-3xl shadow-2xl flex items-center justify-between border border-slate-800 transition active:scale-98"
          >
            <div className="flex items-center gap-3">
              <span className="bg-orange-600 text-white px-2.5 py-1 rounded-xl text-xs font-black shadow-md">
                {totalItemCount} Items
              </span>
              <span className="text-base font-black">₹{grandTotal}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black text-orange-400">
              <span>View Cart & Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Checkout Drawer (Slide Over Modal) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsCartOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          {/* Drawer Body */}
          <aside className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">

            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-orange-100 text-orange-600 shadow-xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Your Basket</h3>
                  <p className="text-xs text-slate-500 font-medium">Ambikapur Express Delivery</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 divide-y divide-slate-100">
              {cartItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-10 h-10 stroke-1" />
                  </div>
                  <h4 className="font-black text-slate-900 text-lg">Your cart is empty</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Add delicious hot meals from Ambikapur restaurants to build your order!
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="pt-3.5 first:pt-0 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div
                          className={`w-3.5 h-3.5 border-2 flex items-center justify-center ${item.isVeg ? "border-emerald-600" : "border-rose-600"
                            }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">{item.restaurantName}</p>
                        <span className="text-xs font-bold text-slate-700 mt-0.5 block">₹{item.price}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="text-slate-500 hover:text-orange-600 font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 w-3 text-center">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="text-slate-500 hover:text-orange-600 font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-black text-slate-900 w-12 text-right">
                        ₹{item.price * item.qty}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bill Details & Payment */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-slate-50/80 space-y-4">

                {/* Bill Breakdown */}
                <div className="space-y-2 text-xs font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Item Total</span>
                    <span className="font-bold text-slate-900">₹{itemTotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      Delivery Fee <span className="text-[10px] text-orange-600 font-bold">(0-2 km)</span>
                    </span>
                    <span className="font-bold text-slate-900">₹{deliveryFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span className="font-bold text-slate-900">₹{platformFee}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-black text-slate-900">
                    <span>To Pay</span>
                    <span className="text-orange-600">₹{grandTotal}</span>
                  </div>
                </div>

                {/* Customer Details Inputs */}
                <div className="space-y-2 pt-1">
{savedAddresses.length > 0 && <label className="mb-3 block text-xs font-bold">Saved delivery address<select className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3" defaultValue="" onChange={e=>{const a=savedAddresses.find(a=>a.id===e.target.value);if(a){setSelectedLocation(a.label+", Ambikapur");setAddressDetails(a.address);setDeliveryCoords({lat:a.lat,lng:a.lng});}}}><option value="" disabled>Choose a saved address</option>{savedAddresses.map(a=><option key={a.id} value={a.id}>{a.label}: {a.address}</option>)}</select></label>}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Your Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Phone (Ambikapur)</label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Mobile Number"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Location Selector */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-xs flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-bold">Delivery Location</strong>
                      <span
                        onClick={() => setIsLocationModalOpen(true)}
                        className="text-orange-600 text-[11px] font-bold cursor-pointer hover:underline"
                      >
                        Change
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">
                      {selectedLocation}
                    </p>
                  </div>
                </div>

                <label className="block text-xs font-bold">House number / street / landmark
                  <input value={addressDetails} onChange={e => setAddressDetails(e.target.value)} maxLength={300} placeholder="e.g. House 12, near the school" className="mt-2 w-full rounded-xl border p-3 text-sm" />
                </label>
                {/* Payment Option Switcher */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Payment Method
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod("COD")}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                        paymentMethod === "COD"
                          ? "bg-orange-50 border-orange-500 text-orange-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash (COD)</span>
                    </button>
                    <button
                      disabled title="Online payments coming soon" onClick={() => setPaymentMethod("COD")}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                        paymentMethod === "UPI"
                          ? "bg-orange-50 border-orange-500 text-orange-600 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Instant UPI</span>
                    </button>
                  </div>
                </div>

                {/* Place Order Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder}
                  className="w-full bg-orange-600 hover:bg-orange-700 active:scale-[0.98] disabled:opacity-60 text-white font-black py-4 px-5 rounded-2xl shadow-xl shadow-orange-600/30 flex items-center justify-between transition"
                >
                  <div className="text-left">
                    <span className="text-[10px] text-orange-200 block uppercase tracking-wider">Total</span>
                    <span className="text-base font-black">₹{grandTotal}</span>
                  </div>
                  <span className="flex items-center gap-1 font-bold text-sm">
                    {isPlacingOrder ? "Placing Order..." : "Place Order Now →"}
                  </span>
                </button>

                {/* Guarantee Banner */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Ambikapur Guaranteed 30-min Delivery</span>
                </div>

              </div>
            )}

            {/* Success Overlay Modal */}
            {orderPlaced && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center z-50 animate-in fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Order Placed Successfully!</h3>
                <span className="bg-orange-100 text-orange-700 font-black text-xs px-3 py-1 rounded-full mt-2 inline-block">
                  {placedOrderDetails?.orderNumber || "#AB-LIVE"}
                </span>
                <p className="text-xs text-slate-500 mt-2 max-w-[280px]">
                  Real order dispatched to restaurant kitchen & Ambikapur rider network!
                </p>

                <div className="mt-5 flex flex-col gap-2 w-full max-w-[260px]">
                  <Link
                    href={`/order/${placedOrderDetails?.id || placedOrderDetails?.orderNumber || "demo-ord-1"}`}
                    className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black py-3 rounded-xl transition shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2"
                  >
                    <Bike className="w-4 h-4" />
                    <span>Track Live Order & View PIN →</span>
                  </Link>


                  <button
                    onClick={() => {
                      setOrderPlaced(false);
                      setIsCartOpen(false);
                      setCart({});
                    }}
                    className="bg-slate-100 text-slate-700 text-xs font-bold py-2 rounded-xl hover:bg-slate-200 transition mt-1"
                  >
                    Back to Food Menu
                  </button>
                </div>
              </div>
            )}

          </aside>
        </div>
      )}

      {/* Ambikapur Location Picker Modal */}
      {isLocationModalOpen && (
        <ZomatoLocationModal
          initialCoords={deliveryCoords}
          initialAddress={selectedLocation}
          onClose={() => setIsLocationModalOpen(false)}
          onConfirm={(loc) => {
            setSelectedLocation(loc.label);
            setDeliveryCoords({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy });
            setDeliveryDetails((current) => ({ ...current, area: loc.area }));
            setLocationMessage(`Exact GPS pin locked (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)})`);
            setIsLocationModalOpen(false);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-400 font-medium mb-14 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-orange-600 text-white font-black text-xs flex items-center justify-center">
              A
            </span>
            <BrandLogo size={44} />
            <span>• Hyperlocal Food Delivery for Ambikapur City</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-bold">



          </div>
        </div>
      </footer>

      {/* Floating Bottom Bar on Mobile when items are in cart */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-16 left-3 right-3 z-40 md:hidden animate-in slide-in-from-bottom-3">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3 px-4 rounded-2xl shadow-xl flex items-center justify-between transition active:scale-98"
          >
            <div className="text-left flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-[10px] text-orange-100 font-extrabold uppercase tracking-wider block">
                  {totalItemCount} ITEM{totalItemCount > 1 ? "S" : ""} IN BASKET
                </span>
                <span className="text-sm font-black text-white">₹{grandTotal}</span>
              </div>
            </div>
            <span className="text-xs font-black bg-white text-orange-600 px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1">
              Checkout <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}

      {/* Native Mobile Bottom Navigation Dock */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around md:hidden shadow-lg">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-orange-600">
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-black">Food</span>
        </Link>
        <button
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-slate-900 relative"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {totalItemCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-orange-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                {totalItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Cart</span>
        </button>


                <Link href={account ? "/account" : "/login"} className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-orange-600"><ShieldCheck className="w-5 h-5"/><span className="text-[10px] font-bold">Account</span></Link>

      </div>

    </div>
  );
}
