"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  Clock,
  ShieldCheck,
  Plus,
  Minus,
  Check,
  Flame,
  Heart,
  Share2,
  Sparkles,
  ShoppingBag,
  Store,
  BadgePercent,
  CheckCircle2,
  UtensilsCrossed,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  category: string;
  price: number;
  originalPrice: number;
  isVeg: boolean;
  rating: number;
  reviewsCount: number;
  prepTime: string;
  calories: string;
  protein: string;
  description: string;
  chefNote: string;
  imageUrl: string;
  ingredients: string[];
}

const PRODUCTS_DATABASE: { [key: string]: Product } = {
  "1": {
    id: "1",
    name: "Special Chicken Dum Biryani (Handi)",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    category: "Biryani Special",
    price: 320,
    originalPrice: 380,
    isVeg: false,
    rating: 4.8,
    reviewsCount: 420,
    prepTime: "25-30 Mins",
    calories: "650 kcal",
    protein: "38g Protein",
    description:
      "Slow cooked in traditional earthen handi using marinated tender farm chicken, premium long-grain aged Daawat basmati rice, hard-boiled egg, saffron milk and rich pure Desi ghee. Served hot with creamy cucumber boondi raita and spicy salan.",
    chefNote: "Cooked fresh every afternoon and evening over low firewood flame according to Ambikapur royal spices recipe.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
    ingredients: ["Aged Basmati Rice", "Tender Farm Chicken", "Kashmiri Saffron", "Desi Ghee", "Boiled Egg", "Star Anise & Green Cardamom"],
  },
  "2": {
    id: "2",
    name: "Paneer Tikka Butter Roll",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    category: "Rolls & Wraps",
    price: 120,
    originalPrice: 150,
    isVeg: true,
    rating: 4.6,
    reviewsCount: 180,
    prepTime: "15-20 Mins",
    calories: "420 kcal",
    protein: "18g Protein",
    description:
      "Chunks of fresh cottage cheese marinated in hung curd and red tandoori masala, charred in clay oven, wrapped tightly inside crisp butter layered flaky lachha paratha with tangy pudina chutney and crunchy onion rings.",
    chefNote: "Prepared live upon order placement to ensure paratha remains crispy and piping hot.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg",
    ingredients: ["Fresh Malai Paneer", "Whole Wheat Lachha Paratha", "Mint Coriander Salsa", "Amul Butter", "Chaat Masala Spiced Onions"],
  },
  "3": {
    id: "3",
    name: "Tandoori Roasted Chicken (Half)",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    category: "Tandoor Starters",
    price: 250,
    originalPrice: 290,
    isVeg: false,
    rating: 4.7,
    reviewsCount: 215,
    prepTime: "20-25 Mins",
    calories: "520 kcal",
    protein: "46g Protein",
    description:
      "Tender half chicken bone-in cuts soaked in overnight citrus spice brine, marinated in Kashmiri red chilli and hung yogurt, roasted over charcoal coals for that authentic smoky aroma.",
    chefNote: "Served with lemon wedges, spicy pickled onions and our signature green mint chutney.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/tandoori_roasted_chicken.jpg",
    ingredients: ["Bone-in Chicken", "Hung Curd", "Degi Mirch", "Kasuri Methi", "Charcoal Roasted Aromatics"],
  },
  "4": {
    id: "4",
    name: "Ambikapur Royal Veg Thali",
    restaurantId: "rest-1",
    restaurantName: "The Royal Kitchen",
    category: "Thali Meals",
    price: 180,
    originalPrice: 220,
    isVeg: true,
    rating: 4.5,
    reviewsCount: 190,
    prepTime: "20 Mins",
    calories: "780 kcal",
    protein: "24g Protein",
    description:
      "Grand wholesome meal combo including Paneer Butter Masala, Dal Makhani / Tadka, Seasonal Sukhi Sabzi, 4 Tawa Butter Rotis, fragrant Jeera Rice, fresh Cucumber Tomato Salad, Lemon Pickle and 1 soft Gulab Jamun.",
    chefNote: "Ambikapur's most loved complete lunch thali for over 10 years.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/royal_veg_thali.jpg",
    ingredients: ["Paneer Gravy", "Yellow Dal Tadka", "4 Butter Rotis", "Jeera Rice", "Gulab Jamun"],
  },
  "5": {
    id: "5",
    name: "Double Cheese Crunchy Burger",
    restaurantId: "rest-2",
    restaurantName: "Burger Hub",
    category: "Burgers",
    price: 140,
    originalPrice: 170,
    isVeg: true,
    rating: 4.6,
    reviewsCount: 130,
    prepTime: "15 Mins",
    calories: "490 kcal",
    protein: "14g Protein",
    description:
      "Double layer of molten cheese slice over a super crispy spiced potato vegetable patty, topped with fresh iceberg lettuce, sliced tomatoes, gherkins and smoky chipotle mayo on toasted brioche bun.",
    chefNote: "Pair with seasoned peri peri fries and chocolate shake for the best combo.",
    imageUrl: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/double_cheese_burger.jpg",
    ingredients: ["Toasted Brioche Bun", "Crispy Herb Patty", "Dual Cheddar Slices", "Iceberg Lettuce", "Chipotle Mayo"],
  },
};

function parseImages(imageUrl: string | undefined): string[] {
  if (!imageUrl) return ["https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg"];
  if (imageUrl.startsWith("[")) {
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [imageUrl];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = (params?.id as string) || "1";

  const [product, setProduct] = useState<Product | null>(() => {
    return PRODUCTS_DATABASE[productId] || null;
  });
  const [loading, setLoading] = useState<boolean>(() => !PRODUCTS_DATABASE[productId]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Fast direct fetch by id from Supabase
  useEffect(() => {
    fetch(`/api/menu?id=${productId}`)
      .then((r) => r.json())
      .then((data) => {
        const found = data.items?.[0] || data.menuItems?.[0];
        if (found) {
          // Intelligent Image fallback for Paneer Roll if old URL had pizza
          let finalImg = found.image_url;
          if (found.name && found.name.toLowerCase().includes("roll")) {
            finalImg = "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg";
          }

          setProduct({
            id: found.id,
            name: found.name,
            restaurantId: found.restaurant_id || "rest-1",
            restaurantName: found.restaurants?.name || "The Royal Kitchen",
            category: found.category || "Rolls & Wraps",
            price: Number(found.price),
            originalPrice: found.original_price ? Number(found.original_price) : Number(found.price) + 30,
            isVeg: Boolean(found.is_veg),
            rating: Number(found.rating) || 4.7,
            reviewsCount: 180,
            prepTime: "15-20 Mins",
            calories: "420 kcal",
            protein: "18g Protein",
            description: found.description || "Prepared hot & fresh live upon order placement with premium ingredients.",
            chefNote: "Prepared live to ensure it remains crispy, aromatic and piping hot.",
            imageUrl: finalImg || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/paneer_tikka_butter_roll.jpg",
            ingredients: ["Fresh Malai Paneer", "Flaky Lachha Paratha", "Mint Chutney", "Amul Butter", "Pickled Onions"],
          });
        }
      })
      .catch((e) => console.warn("Dynamic product fetch notice:", e))
      .finally(() => setLoading(false));
  }, [productId]);

  const [quantity, setQuantity] = useState(1);
  const [spiceLevel, setSpiceLevel] = useState<"Mild" | "Medium" | "Extra Spicy">("Medium");
  const [selectedAddons, setSelectedAddons] = useState<{ [name: string]: number }>({});
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isAddedSuccess, setIsAddedSuccess] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const addonsList = [
    { name: "Extra Amul Butter Layer", price: 20 },
    { name: "Extra Spiced Pudina Chutney", price: 15 },
    { name: "Melted Mozzarella Cheese Layer", price: 30 },
    { name: "Chaat Masala French Fries (Side)", price: 45 },
  ];

  const toggleAddon = (name: string, price: number) => {
    setSelectedAddons((prev) => {
      const copy = { ...prev };
      if (copy[name]) {
        delete copy[name];
      } else {
        copy[name] = price;
      }
      return copy;
    });
  };

  // 1. Loading Skeleton Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-stone-800 antialiased pb-28">
        <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EDE5DA] px-4 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
            <div className="w-32 h-4 bg-stone-200 rounded-lg animate-pulse" />
          </div>
          <div className="w-9 h-9 rounded-full bg-stone-200 animate-pulse" />
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-white rounded-3xl overflow-hidden border border-[#EDE5DA] shadow-xs animate-pulse">
            <div className="h-72 sm:h-80 w-full bg-stone-200" />
            <div className="p-6 space-y-4">
              <div className="w-28 h-4 bg-stone-200 rounded" />
              <div className="w-3/4 h-8 bg-stone-200 rounded-xl" />
              <div className="w-40 h-6 bg-stone-200 rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. Dish Not Found Screen
  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shadow-inner">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-stone-900">Dish Not Found</h2>
        <p className="text-xs text-stone-500 max-w-sm">
          This dish may have been updated or removed by the restaurant partner in zuppo.
        </p>
        <Link
          href="/"
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-lg shadow-orange-600/20 transition"
        >
          Back to Food Menu
        </Link>
      </div>
    );
  }

  const images = parseImages(product.imageUrl);
  const addonsTotal = Object.values(selectedAddons).reduce((a, b) => a + b, 0);
  const finalUnitPrice = product.price + addonsTotal;
  const totalPrice = finalUnitPrice * quantity;
  const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

  const handleAddToCart = () => {
    try {
      const saved = localStorage.getItem("ambibites_cart");
      const currentCart = saved ? JSON.parse(saved) : {};
      const existingQty = currentCart[product!.id] || 0;
      currentCart[product!.id] = existingQty + quantity;
      localStorage.setItem("ambibites_cart", JSON.stringify(currentCart));
    } catch {}

    setIsAddedSuccess(true);
    setTimeout(() => {
      router.push("/?openCart=true");
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 antialiased pb-32 font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/80 backdrop-blur-md border-b border-[#EDE5DA] px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-600 hover:text-stone-900 font-bold text-xs transition duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-[#E5DDD2] flex items-center justify-center shadow-xs">
            <ChevronLeft className="w-4 h-4 text-stone-700" />
          </div>
          <span className="hidden sm:inline">Back to Store</span>
        </Link>

        {/* Center Brand */}
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-black text-xs">
            z
          </span>
          <span className="text-sm font-black text-stone-900 tracking-tight">
            zuppo<span className="text-orange-600">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition cursor-pointer ${
              isLiked
                ? "bg-rose-50 border-rose-200 text-rose-600"
                : "bg-white border-[#E5DDD2] text-stone-500 hover:text-rose-500"
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-rose-500" : ""}`} />
          </button>
          <Link
            href="/?openCart=true"
            className="w-8 h-8 rounded-full bg-white border border-[#E5DDD2] hover:border-orange-500 flex items-center justify-center text-stone-700 hover:text-orange-600 transition shadow-xs"
          >
            <ShoppingBag className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Product Showcase Card */}
        <div className="bg-white rounded-3xl overflow-hidden border border-[#EDE5DA] shadow-[0_15px_40px_rgba(200,180,160,0.12)]">
          {/* Main Visual Photo Container */}
          <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-stone-100 overflow-hidden">
            <img
              src={images[activeImageIdx] || images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-102"
            />

            {/* Subtle Gradient for Overlaid Badges */}
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-black/10 pointer-events-none" />

            {/* Top Overlay Pills */}
            <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10">
              {/* Veg / Non-Veg Standard Food Symbol */}
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-xl bg-white/95 backdrop-blur-md shadow-md border ${
                    product.isVeg ? "border-emerald-200" : "border-rose-200"
                  }`}
                >
                  <div
                    className={`w-4 h-4 border-2 flex items-center justify-center ${
                      product.isVeg ? "border-emerald-600" : "border-rose-600"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        product.isVeg ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    />
                  </div>
                </div>

                <span className="bg-stone-900/80 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-md uppercase tracking-wider">
                  {product.category}
                </span>
              </div>

              {/* Star Rating Badge */}
              <div className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-md flex items-center gap-1 border border-stone-100">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-xs font-black text-stone-900">{product.rating}</span>
                <span className="text-[10px] text-stone-400 font-semibold">({product.reviewsCount})</span>
              </div>
            </div>

            {/* Bottom Photo Nutrition Pills */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-1.5 bg-stone-900/80 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-bold shadow-md">
                <Clock className="w-3.5 h-3.5 text-orange-400" />
                <span>{product.prepTime}</span>
                <span className="text-stone-500">•</span>
                <span>{product.calories}</span>
                <span className="text-stone-500">•</span>
                <span className="text-amber-300">{product.protein}</span>
              </div>
            </div>
          </div>

          {/* Details & Interactive Form */}
          <div className="p-5 sm:p-7 space-y-6">
            {/* Restaurant Link & Dish Name */}
            <div>
              <Link
                href={`/restaurant/${product.restaurantId}`}
                className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-orange-600 tracking-wider hover:underline mb-1"
              >
                <Store className="w-3 h-3" />
                <span>By {product.restaurantName}</span>
              </Link>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Price & Discount Banner */}
            <div className="flex items-center justify-between py-3.5 px-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA]">
              <div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl font-black text-stone-900">₹{product.price}</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-sm text-stone-400 line-through font-bold">
                      ₹{product.originalPrice}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <BadgePercent className="w-3 h-3" />
                      {discountPercent}% OFF (Save ₹{product.originalPrice - product.price})
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-bold mt-0.5">
                  Inclusive of all taxes & packaging • Delivered via zuppo fleet
                </p>
              </div>

              {/* Quantity Counter */}
              <div className="flex items-center gap-2 bg-white border border-[#E5DDD2] px-2.5 py-1.5 rounded-2xl shadow-xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-black text-stone-900 w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dish Description */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-black uppercase text-stone-500 tracking-wider">
                Dish Description
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-medium">
                {product.description}
              </p>
            </div>

            {/* Chef Heritage Note */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="font-black text-amber-900 block">Chef&apos;s Heritage Note</strong>
                <p className="text-amber-800 mt-0.5 leading-snug font-medium">{product.chefNote}</p>
              </div>
            </div>

            {/* Key Fresh Ingredients Pills */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase text-stone-500 tracking-wider">
                Key Fresh Ingredients
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {product.ingredients.map((ing, i) => (
                  <span
                    key={i}
                    className="bg-[#FAF7F2] text-stone-700 text-[11px] font-bold px-3 py-1 rounded-xl border border-[#EDE5DA]"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>

            {/* Customization 1: Spice Preference */}
            <div className="pt-4 border-t border-[#EDE5DA] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider">
                  Spice Customization
                </h3>
                <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                  Required
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {(["Mild", "Medium", "Extra Spicy"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSpiceLevel(level)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      spiceLevel === level
                        ? "bg-orange-50 border-orange-500 text-orange-700 shadow-xs ring-1 ring-orange-500"
                        : "bg-white border-[#E5DDD2] text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${spiceLevel === level ? "text-orange-600" : "text-stone-400"}`} />
                    <span>{level}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customization 2: Add-ons & Sides */}
            <div className="pt-4 border-t border-[#EDE5DA] space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider">
                  Optional Add-ons & Sides
                </h3>
                <span className="text-[10px] text-stone-400 font-semibold">Customise to taste</span>
              </div>

              <div className="space-y-2">
                {addonsList.map((addon) => {
                  const isChecked = !!selectedAddons[addon.name];
                  return (
                    <div
                      key={addon.name}
                      onClick={() => toggleAddon(addon.name, addon.price)}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "bg-orange-50/60 border-orange-400 shadow-xs"
                          : "bg-white border-[#E5DDD2] hover:bg-[#FAF7F2]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                            isChecked
                              ? "bg-orange-600 border-orange-600 text-white"
                              : "border-stone-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-bold text-stone-800">{addon.name}</span>
                      </div>
                      <span className="text-xs font-black text-stone-900">+₹{addon.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cooking Notes Input */}
            <div className="pt-4 border-t border-[#EDE5DA] space-y-1.5">
              <label className="text-xs font-black text-stone-700 uppercase tracking-wider block">
                Kitchen Cooking Instructions
              </label>
              <input
                type="text"
                placeholder="e.g. Extra mint chutney, less spicy onion rings, cut into 2 halves..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-orange-500 outline-none transition"
              />
            </div>

            {/* Delivery Guarantee */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EDE5DA] flex items-center gap-2.5 text-xs text-stone-600 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Fast local delivery guaranteed within 20–30 mins in Ambikapur.</span>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Sticky Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FAF7F2]/95 backdrop-blur-md border-t border-[#EDE5DA] p-3.5 z-40 shadow-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-stone-400 uppercase font-black tracking-wider block">
              Total ({quantity} item{quantity > 1 ? "s" : ""})
            </span>
            <span className="text-xl font-black text-stone-900">₹{totalPrice}</span>
          </div>

          <button
            onClick={handleAddToCart}
            className={`flex-1 sm:max-w-xs py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-200 active:scale-98 cursor-pointer ${
              isAddedSuccess
                ? "bg-emerald-600 text-white shadow-emerald-600/30"
                : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5"
            }`}
          >
            {isAddedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Added to Basket!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Basket • ₹{totalPrice}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
