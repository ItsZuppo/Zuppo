"use client";

import BrandLogo from "@/components/BrandLogo";
import KitchenPickupLocation from "@/components/KitchenPickupLocation";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Volume2,
  VolumeX,
  AlertTriangle,
  ChefHat,
  ArrowRight,
  ToggleRight,
  ToggleLeft,
  ChevronRight,
  Check,
  Bike,
  Plus,
  UploadCloud,
  X,
  Loader2,
  Edit,
  Trash2,
  ExternalLink,
  Sparkles,
  Settings,
  Search,
  Utensils,
  Layers,
  ChevronDown,
  ShoppingBag,
  LogOut,
  Lock,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

interface IncomingOrder {
  id: string;
  orderNumber: string;
  timeRemainingSec: number;
  customerName: string;
  deliveryArea: string;
  restaurantName?: string;
  items: { name: string; qty: number; price: number; isVeg?: boolean }[];
  totalAmount: number;
  status: "incoming" | "preparing" | "ready";
  rawStatus: string;
  riderName?: string | null;
  prepTimeMinutes: number;
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

const CATEGORY_PRESETS = [
  "All",
  "Pizzas",
  "Burgers & Fast Food",
  "Biryani & Rice",
  "Rolls & Starters",
  "Main Course",
  "Thali Meals",
  "Dosas & South Indian",
  "Chaat & Street Food",
  "Desserts & Sweets",
  "Beverages & Shakes",
];

export default function RestaurantPartnerHub() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<"orders" | "menu" | "kitchenSettings">("orders");
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [orders, setOrders] = useState<IncomingOrder[]>([]);

  // Kitchens State & Switcher
  const [kitchens, setKitchens] = useState<any[]>([]);
  const [activeKitchenId, setActiveKitchenId] = useState<string>("");
  const [isKitchenDropdownOpen, setIsKitchenDropdownOpen] = useState(false);

  // Active kitchen object
  const activeKitchen =
    kitchens.find((k) => k.id === activeKitchenId) ||
    (currentUser?.restaurantId
      ? {
          id: currentUser.restaurantId,
          name: currentUser.restaurantName || currentUser.name || "My Kitchen",
          area: currentUser.area || "Ambikapur",
          cuisine: "Ambikapur Kitchen",
          is_open: true,
          banner_url: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
          delivery_time_text: "25-30 min",
        }
      : null) ||
    kitchens[0] || {
      id: "11111111-1111-1111-1111-111111111111",
      name: "The Royal Kitchen",
      area: "Gandhi Chowk",
      cuisine: "North Indian, Mughlai, Biryani",
      is_open: true,
      banner_url: "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg",
      delivery_time_text: "25-30 min",
    };

  // Menu items for active kitchen
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");

  // Add / Edit Dish Modal State
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishUploading, setDishUploading] = useState(false);
  const [dishName, setDishName] = useState("");
  const [dishPrice, setDishPrice] = useState("");
  const [dishOriginalPrice, setDishOriginalPrice] = useState("");
  const [dishCategory, setDishCategory] = useState("Main Course");
  const [dishIsVeg, setDishIsVeg] = useState(true);
  const [dishIsBestseller, setDishIsBestseller] = useState(false);
  const [dishDescription, setDishDescription] = useState("");
  const [dishImages, setDishImages] = useState<string[]>([]);

  // Custom Add-ons / Variants State (e.g. Extra Cheese, Half/Full size)
  const [dishAddons, setDishAddons] = useState<{ name: string; price: number }[]>([]);
  const [addonInputName, setAddonInputName] = useState("");
  const [addonInputPrice, setAddonInputPrice] = useState("");

  // Kitchen Settings Form State
  const [isEditingKitchen, setIsEditingKitchen] = useState(false);
  const [editKitchenName, setEditKitchenName] = useState("");
  const [editKitchenArea, setEditKitchenArea] = useState("");
  const [editKitchenCuisine, setEditKitchenCuisine] = useState("");
  const [editKitchenDeliveryTime, setEditKitchenDeliveryTime] = useState("");
  const [editKitchenBanner, setEditKitchenBanner] = useState("");
  const [isUploadingKitchenBanner, setIsUploadingKitchenBanner] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Fetch Kitchens
  const fetchKitchens = async () => {
    try {
      const res = await fetch("/api/restaurants");
      const data = await res.json();
      if (data.success && data.restaurants?.length > 0) {
        setKitchens(data.restaurants);
      }
    } catch (e) {
      console.warn("Kitchens fetch notice:", e);
    }
  };

  // 2. Fetch Menu Items for Selected Kitchen
  const fetchMenuItems = async (targetKitchenId?: string) => {
    const targetId = targetKitchenId || activeKitchenId;
    if (!targetId) return;
    try {
      const res = await fetch(`/api/menu?restaurantId=${targetId}`);
      const data = await res.json();
      const list = data.items || data.menuItems || [];
      setMenuItems(
        list.map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category || "Main Course",
          price: Number(m.price),
          originalPrice: m.original_price ? Number(m.original_price) : undefined,
          isVeg: Boolean(m.is_veg),
          isBestseller: Boolean(m.is_bestseller),
          inStock: m.in_stock !== false,
          description: m.description || "",
          imageUrl: m.image_url,
          images: parseImages(m.image_url),
        }))
      );
    } catch (e) {
      console.warn("Menu fetch error:", e);
    }
  };

  // 3. Fetch Orders
  const fetchPartnerOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success && data.orders) {
        const mapped: IncomingOrder[] = data.orders.map((o: any) => {
          let posStatus: "incoming" | "preparing" | "ready" = "incoming";
          if (o.status === "preparing") posStatus = "preparing";
          else if (
            o.status === "ready" ||
            o.status === "rider_assigned" ||
            o.status === "picked_up" ||
            o.status === "delivered"
          )
            posStatus = "ready";
          else if (o.status === "placed") posStatus = "incoming";

          return {
            id: o.id,
            orderNumber: o.orderNumber,
            timeRemainingSec: 180,
            customerName: o.customerName,
            deliveryArea: o.deliveryArea,
            restaurantName: o.restaurantName,
            items: o.items || [],
            totalAmount: o.totalAmount,
            status: posStatus,
            rawStatus: o.status,
            riderName: o.riderName,
            prepTimeMinutes: o.prepTimeMinutes || 20,
          };
        });
        setOrders(mapped);
      }
    } catch (e) {
      console.warn("Partner orders notice:", e);
    }
  };

  // Check authenticated session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated || !data.user) {
          router.push("/partner/login");
          return;
        }
        if (data.user.role !== "partner" && data.user.role !== "admin") {
          router.push("/partner/login");
          return;
        }
        setCurrentUser(data.user);
        const resolvedId =
          data.user.restaurantId || "11111111-1111-1111-1111-111111111111";
        setActiveKitchenId(resolvedId);
        fetchMenuItems(resolvedId);
        setAuthChecking(false);
      })
      .catch(() => {
        router.push("/partner/login");
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/partner/login");
  };

  useEffect(() => {
    fetchKitchens();
    fetchPartnerOrders();
    const interval = setInterval(fetchPartnerOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeKitchenId) {
      fetchMenuItems(activeKitchenId);
      if (activeKitchen) {
        setEditKitchenName(activeKitchen.name);
        setEditKitchenArea(activeKitchen.area || activeKitchen.address || "");
        setEditKitchenCuisine(activeKitchen.cuisine || "");
        setEditKitchenDeliveryTime(activeKitchen.delivery_time_text || "25-30 min");
        setEditKitchenBanner(activeKitchen.banner_url || "");
      }
    }
  }, [activeKitchenId]);

  // Order Handlers
  const handleAccept = async (orderId: string) => {
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "preparing" }),
      });
      fetchPartnerOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (orderId: string) => {
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "cancelled" }),
      });
      fetchPartnerOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "ready" }),
      });
      fetchPartnerOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispatchRider = async (orderId: string) => {
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: "ready", // Broadcasts to all online riders' radar open pool (no auto-assignment)
        }),
      });
      fetchPartnerOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Stock Toggle
  const toggleStock = async (id: string, currentStock: boolean) => {
    setMenuItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, inStock: !currentStock } : m))
    );
    try {
      await fetch("/api/menu", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, inStock: !currentStock }),
      });
      showToast(!currentStock ? "Dish marked In Stock" : "Dish marked Sold Out");
    } catch (e) {
      console.error("Stock update error:", e);
    }
  };

  // Delete Dish
  const handleDeleteDish = async (dishId: string, dishTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${dishTitle}" from this kitchen menu?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/menu?id=${dishId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast(`🗑️ "${dishTitle}" deleted from menu!`);
        fetchMenuItems();
      } else {
        alert("Failed to delete dish: " + (data.error || "Unknown"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // Open Edit Dish Modal
  const handleOpenEditDish = (dish: any) => {
    setEditingDishId(dish.id);
    setDishName(dish.name);
    setDishPrice(String(dish.price));
    setDishOriginalPrice(dish.originalPrice ? String(dish.originalPrice) : "");
    setDishCategory(dish.category || "Main Course");
    setDishIsVeg(dish.isVeg);
    setDishIsBestseller(dish.isBestseller);

    // Extract customizations from description if available
    let rawDesc = dish.description || "";
    let extractedAddons: { name: string; price: number }[] = dish.addons || [];
    if ((!extractedAddons || extractedAddons.length === 0) && rawDesc.includes("Customizations:")) {
      const parts = rawDesc.split(/Customizations:\s*/i);
      rawDesc = parts[0].trim();
      const addonParts = parts[1]?.split(",") || [];
      extractedAddons = addonParts
        .map((p: string) => {
          const match = p.match(/(.*?)\s*\(\+?₹?(\d+)\)/);
          if (match) {
            return { name: match[1].trim(), price: Number(match[2]) };
          }
          return { name: p.trim(), price: 0 };
        })
        .filter((a: any) => Boolean(a.name));
    }

    setDishDescription(rawDesc);
    setDishImages(dish.images || []);
    setDishAddons(extractedAddons);
    setAddonInputName("");
    setAddonInputPrice("");
    setIsDishModalOpen(true);
  };

  // Open Add Dish Modal
  const handleOpenAddDish = () => {
    setEditingDishId(null);
    setDishName("");
    setDishPrice("");
    setDishOriginalPrice("");
    setDishCategory(selectedCategory !== "All" ? selectedCategory : "Pizzas");
    setDishIsVeg(true);
    setDishIsBestseller(false);
    setDishDescription("");
    setDishImages([]);
    setDishAddons([]);
    setAddonInputName("");
    setAddonInputPrice("");
    setIsDishModalOpen(true);
  };

  const handleAddCustomAddon = () => {
    if (!addonInputName.trim()) return;
    const priceNum = Number(addonInputPrice) || 0;
    setDishAddons((prev) => [...prev, { name: addonInputName.trim(), price: priceNum }]);
    setAddonInputName("");
    setAddonInputPrice("");
  };

  const handleRemoveAddon = (idx: number) => {
    setDishAddons((prev) => prev.filter((_, i) => i !== idx));
  };

  // Upload Dish Photos with Auto-Compression
  const handleDishUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setDishUploading(true);
    try {
      const fd = new FormData();
      // Compress each dish photo client-side before sending to Cloudflare R2
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.85,
        });
        fd.append("files", compressed.file);
      }
      fd.append("folder", "food");

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && (data.urls || data.url)) {
        const newUrls = data.urls || [data.url];
        setDishImages((prev) => [...prev, ...newUrls]);
        showToast(`✅ ${newUrls.length} food photo(s) auto-compressed & uploaded to Cloudflare!`);
      } else {
        alert("Upload failed: " + (data.error || "Unknown"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setDishUploading(false);
    }
  };

  const removeDishImage = (idxToRemove: number) => {
    setDishImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Save Dish (Create or Update)
  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dishName || !dishPrice) {
      alert("Name and price are required");
      return;
    }

    try {
      let finalDescription = dishDescription.trim();
      if (dishAddons.length > 0) {
        const addonStr = dishAddons.map((a) => `${a.name} (+₹${a.price})`).join(", ");
        finalDescription = finalDescription
          ? `${finalDescription}\n\nCustomizations: ${addonStr}`
          : `Customizations: ${addonStr}`;
      }

      const payload: any = {
        name: dishName,
        price: Number(dishPrice),
        originalPrice: dishOriginalPrice ? Number(dishOriginalPrice) : null,
        category: dishCategory.trim() || "Main Course",
        isVeg: dishIsVeg,
        isBestseller: dishIsBestseller,
        description: finalDescription || "Freshly prepared in Ambikapur kitchen.",
        imageUrl: dishImages[0] || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg",
        images: dishImages,
        addons: dishAddons,
        restaurantId: activeKitchen.id,
      };

      if (editingDishId) {
        // Update existing dish
        const res = await fetch("/api/menu", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingDishId }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`✨ "${dishName}" updated successfully!`);
          setIsDishModalOpen(false);
          fetchMenuItems();
        } else {
          alert("Failed to update: " + data.error);
        }
      } else {
        // Create new dish
        const res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`🎉 "${dishName}" added to ${activeKitchen.name} menu!`);
          setIsDishModalOpen(false);
          fetchMenuItems();
        } else {
          alert("Failed to create dish: " + data.error);
        }
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Upload Kitchen Banner with Auto-Compression
  const handleKitchenBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingKitchenBanner(true);
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.85,
      });
      const fd = new FormData();
      fd.append("file", compressed.file);
      fd.append("folder", "restaurants");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && data.url) {
        setEditKitchenBanner(data.url);
        showToast("Kitchen banner auto-compressed & uploaded to Cloudflare R2!");
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploadingKitchenBanner(false);
    }
  };

  // Save Kitchen Profile
  const handleSaveKitchenProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeKitchen.id,
          name: editKitchenName,
          area: editKitchenArea,
          address: editKitchenArea + ", Ambikapur",
          cuisine: editKitchenCuisine,
          deliveryTime: editKitchenDeliveryTime,
          bannerUrl: editKitchenBanner,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("🏪 Kitchen details saved live!");
        fetchKitchens();
      } else {
        alert("Failed to save: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Toggle Kitchen Open/Close
  const toggleKitchenOpen = async () => {
    const nextState = !activeKitchen.is_open;
    try {
      await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeKitchen.id, is_open: nextState }),
      });
      showToast(nextState ? "🟢 Kitchen is OPEN & accepting orders" : "🔴 Kitchen is CLOSED");
      fetchKitchens();
    } catch (err) {
      console.error(err);
    }
  };

  // Categories with item counts
  const dynamicCategories = Array.from(
    new Set(menuItems.map((m) => m.category).filter(Boolean))
  ) as string[];

  const allDisplayCategories = Array.from(
    new Set(["All", ...CATEGORY_PRESETS.slice(1), ...dynamicCategories])
  );

  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
    if (menuSearchQuery && !item.name.toLowerCase().includes(menuSearchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const incomingCount = orders.filter((o) => o.status === "incoming").length;

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="text-xs font-bold text-slate-300">Loading Secure Kitchen Portal...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-orange-600 text-white text-xs font-black px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-top flex items-center gap-2 border border-orange-400">
          <Sparkles className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header Hub */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-8 py-3 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Kitchen Switcher */}
          <div className="flex items-center gap-3">
            <BrandLogo size={50} />

            {/* Active Kitchen Selector or Locked Partner Card */}
            {currentUser?.role === "partner" ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">{activeKitchen.name}</span>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase px-1.5 py-0.2 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Authenticated
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {activeKitchen.area || "Ambikapur"} • {currentUser.email || currentUser.phone || "Verified Partner"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setIsKitchenDropdownOpen(!isKitchenDropdownOpen)}
                  className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 px-3 py-1.5 rounded-xl transition cursor-pointer text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white">{activeKitchen.name}</span>
                      <span className="bg-purple-500/20 text-purple-400 text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                        Admin Mode
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {activeKitchen.area || "Ambikapur"} • Switch Kitchen
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
                </button>

                {/* Kitchens Dropdown Modal / Popover */}
                {isKitchenDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1.5">
                      Switch Kitchen (Admin Access)
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {kitchens.map((k) => (
                        <button
                          key={k.id}
                          onClick={() => {
                            setActiveKitchenId(k.id);
                            setIsKitchenDropdownOpen(false);
                            showToast(`Switched to ${k.name}`);
                          }}
                          className={`w-full text-left p-2 rounded-xl transition text-xs flex items-center justify-between ${
                            k.id === activeKitchen.id
                              ? "bg-orange-600/20 border border-orange-500/50 text-orange-300 font-black"
                              : "hover:bg-slate-800 text-slate-300"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{k.name}</div>
                            <span className="text-[10px] text-slate-400">{k.area || "Ambikapur"}</span>
                          </div>
                          {k.id === activeKitchen.id && (
                            <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "orders"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Orders ({incomingCount})</span>
            </button>

            <button
              onClick={() => setActiveTab("menu")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "menu"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Menu & Food ({menuItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("kitchenSettings")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kitchenSettings"
                  ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Kitchen Profile</span>
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {/* Store Open / Closed Toggle */}
            <button
              onClick={toggleKitchenOpen}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
                activeKitchen.is_open
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                  : "bg-rose-950/60 border-rose-500/40 text-rose-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeKitchen.is_open ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
              <span>{activeKitchen.is_open ? "Taking Orders" : "Kitchen Closed"}</span>
            </button>

            {/* View Live Customer Page */}
            <Link
              href={`/restaurant/${activeKitchen.id}`}
              target="_blank"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              title="Open customer view for this kitchen"
            >
              <span>Customer View</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
              title="Sign out of Kitchen POS"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-6">
        
        {/* TAB 1: LIVE ORDERS FLOW */}
        {activeTab === "orders" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Orders Feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>Kitchen Orders Flow ({activeKitchen.name})</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time sound alerts for incoming Ambikapur food orders.
                  </p>
                </div>
                <button
                  onClick={() => setIsSoundMuted(!isSoundMuted)}
                  className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition"
                >
                  {isSoundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  <span>{isSoundMuted ? "Sound Off" : "Ring Active"}</span>
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-2">
                  <ChefHat className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No active kitchen orders right now</p>
                  <p className="text-xs">When an Ambikapur customer places an order, it will chime here instantly.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">{ord.orderNumber}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              ord.status === "incoming"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : ord.status === "preparing"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {ord.status === "incoming"
                              ? "NEW ORDER"
                              : ord.status === "preparing"
                              ? "COOKING IN KITCHEN"
                              : "READY FOR PICKUP"}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400 font-bold">Prep: {ord.prepTimeMinutes} mins</span>
                      </div>

                      <div className="text-xs text-slate-400">
                        Customer: <strong className="text-white">{ord.customerName}</strong> ({ord.deliveryArea})
                      </div>

                      {/* Items */}
                      <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 space-y-1.5 text-xs">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-slate-300">
                            <span>
                              <strong className="text-orange-400">{it.qty}x</strong> {it.name}
                            </span>
                            <span className="font-bold text-white">₹{it.price * it.qty}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-800 flex justify-between font-black text-white text-sm">
                          <span>Total Amount</span>
                          <span className="text-emerald-400">₹{ord.totalAmount}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {ord.status === "incoming" && (
                          <>
                            <button
                              onClick={() => handleAccept(ord.id)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>Accept & Start Cooking</span>
                            </button>
                            <button
                              onClick={() => handleReject(ord.id)}
                              className="bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {ord.status === "preparing" && (
                          <button
                            onClick={() => handleMarkReady(ord.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ChefHat className="w-4 h-4" />
                            <span>Food Packed: Mark Ready for Rider</span>
                          </button>
                        )}

                        {ord.status === "ready" && (
                          <div className="w-full flex items-center gap-2">
                            <div className="flex-1 bg-slate-950 border border-emerald-500/30 p-2 rounded-xl text-center text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                              <Check className="w-4 h-4" />
                              <span>Food Ready for Pickup</span>
                            </div>
                            <button
                              onClick={() => handleDispatchRider(ord.id)}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Bike className="w-4 h-4" />
                              <span>Dispatch Rider</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right 1 Col: Quick Shift Summary */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-400" />
                  <span>Today's Kitchen Shift</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Orders Completed</span>
                    <strong className="text-white">38 Orders</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Sales</span>
                    <strong className="text-white">₹14,280</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Commission (20%)</span>
                    <strong className="text-orange-400">-₹2,856</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-black text-emerald-400">
                    <span>Your Net Payout</span>
                    <span>₹11,424</span>
                  </div>
                </div>
              </div>

              {/* Quick Add Food Button */}
              <button
                onClick={handleOpenAddDish}
                className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs py-3 rounded-2xl shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Food Item to This Kitchen</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MENU & FOOD CATALOG MANAGER */}
        {activeTab === "menu" && (
          <div className="space-y-6">
            {/* Top Toolbar: Search + Add Food */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-orange-500" />
                  <span>{activeKitchen.name} Menu Catalog ({menuItems.length} Dishes)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Manage dishes, stock toggles, prices and multi-image carousels.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search dishes..."
                    value={menuSearchQuery}
                    onChange={(e) => setMenuSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button
                  onClick={handleOpenAddDish}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-orange-600/20 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Food Dish</span>
                </button>
              </div>
            </div>

            {/* Categorization Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {allDisplayCategories.map((cat) => {
                const count =
                  cat === "All"
                    ? menuItems.length
                    : menuItems.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-black transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      selectedCategory === cat
                        ? "bg-orange-600 text-white shadow-md shadow-orange-600/30 scale-105"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] opacity-75 font-bold">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Dishes Grid */}
            {filteredMenuItems.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
                <Utensils className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">
                  No dishes found in category "{selectedCategory}"
                </p>
                <button
                  onClick={handleOpenAddDish}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-black px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Dish to "{selectedCategory}"</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3 group"
                  >
                    <div>
                      {/* Image Preview & Badges */}
                      <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-slate-950 mb-3 border border-slate-800">
                        <img
                          src={item.images[0] || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span
                            className={`w-3.5 h-3.5 border-2 rounded-sm flex items-center justify-center bg-white ${
                              item.isVeg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.isVeg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>
                          <span className="bg-black/70 backdrop-blur-md text-[9px] font-black uppercase text-orange-400 px-2 py-0.5 rounded-md">
                            {item.category}
                          </span>
                        </div>

                        {/* Photos count badge */}
                        {item.images.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                            <span>📸 {item.images.length} photos</span>
                          </span>
                        )}
                      </div>

                      {/* Title & Price */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-black text-white group-hover:text-orange-400 transition leading-snug">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-black text-emerald-400">₹{item.price}</span>
                            {item.originalPrice && (
                              <span className="text-xs text-slate-500 line-through">
                                ₹{item.originalPrice}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock Switch */}
                        <button
                          onClick={() => toggleStock(item.id, item.inStock)}
                          className="flex items-center gap-1 transition cursor-pointer shrink-0"
                          title="Toggle live in-stock"
                        >
                          {item.inStock ? (
                            <ToggleRight className="w-7 h-7 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-slate-600" />
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {item.description || "Freshly cooked to order in Ambikapur."}
                      </p>
                    </div>

                    {/* Footer Controls: Edit & Delete */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span
                        className={`text-[11px] font-bold ${
                          item.inStock ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {item.inStock ? "● Live In Stock" : "○ Sold Out"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditDish(item)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3 text-orange-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDish(item.id, item.name)}
                          className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 p-1.5 rounded-xl transition cursor-pointer"
                          title="Delete dish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: KITCHEN PROFILE & BANNER SETTINGS */}
        {activeTab === "kitchenSettings" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-orange-500" />
                  <span>{activeKitchen.name} Settings</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Update kitchen identity, photo banner and Ambikapur operating hours.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono">ID: {activeKitchen.id}</span>
            </div>

            <KitchenPickupLocation restaurantId={activeKitchen.id}/>
            <form onSubmit={handleSaveKitchenProfile} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Kitchen Name *</label>
                <input
                  type="text"
                  required
                  value={editKitchenName}
                  onChange={(e) => setEditKitchenName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Area / Landmark</label>
                  <input
                    type="text"
                    value={editKitchenArea}
                    onChange={(e) => setEditKitchenArea(e.target.value)}
                    placeholder="Gandhi Chowk, Ambikapur"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Delivery Time (approx)</label>
                  <input
                    type="text"
                    value={editKitchenDeliveryTime}
                    onChange={(e) => setEditKitchenDeliveryTime(e.target.value)}
                    placeholder="25-30 min"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Cuisine Tags (comma separated)</label>
                <input
                  type="text"
                  value={editKitchenCuisine}
                  onChange={(e) => setEditKitchenCuisine(e.target.value)}
                  placeholder="North Indian, Mughlai, Biryani, Tandoor"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Kitchen Banner Upload */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Kitchen Banner Photo (Cloudflare R2)
                </label>
                <div className="border border-dashed border-slate-700 rounded-2xl p-4 text-center bg-slate-950 flex flex-col items-center justify-center gap-2">
                  {editKitchenBanner ? (
                    <img
                      src={editKitchenBanner}
                      alt="Banner Preview"
                      className="w-full h-36 object-cover rounded-xl"
                    />
                  ) : (
                    <UploadCloud className="w-8 h-8 text-slate-500" />
                  )}

                  <label className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer transition">
                    {isUploadingKitchenBanner ? "Uploading to Cloudflare R2..." : "Choose New Banner Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingKitchenBanner}
                      onChange={handleKitchenBannerUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black px-6 py-2.5 rounded-xl transition shadow cursor-pointer"
                >
                  Save Kitchen Settings
                </button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* MODAL: ADD / EDIT DISH WITH MULTI-IMAGE CAROUSEL */}
      {isDishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative text-white shadow-2xl animate-in zoom-in-95 space-y-4">
            <button
              onClick={() => setIsDishModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-orange-500" />
                <span>{editingDishId ? "Edit Food Dish" : "Add Food Dish to Live Menu"}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Kitchen: <strong className="text-white">{activeKitchen.name}</strong> (ID: {activeKitchen.id.slice(0, 8)}...)
              </p>
            </div>

            <form onSubmit={handleSaveDish} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Margherita Double Cheese Pizza"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Category Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-300 block">
                    Food Category (Select or Type Custom) *
                  </label>
                  <span className="text-[10px] text-orange-400 font-semibold">
                    Live Categorized Menu
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CATEGORY_PRESETS.slice(1).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDishCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        dishCategory === cat
                          ? "bg-orange-600 text-white shadow-xs"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDishCategory("")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border border-dashed ${
                      !CATEGORY_PRESETS.slice(1).includes(dishCategory) && dishCategory.length > 0
                        ? "bg-amber-500/20 text-amber-300 border-amber-500"
                        : "bg-slate-950 text-amber-400 border-amber-500/50 hover:bg-amber-500/10"
                    }`}
                  >
                    ✨ + Type Custom Category
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Momos, Chinese, Cold Beverages, Pasta, Chaat..."
                  value={dishCategory}
                  onChange={(e) => setDishCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-xs"
                />
                <p className="text-[10.5px] text-slate-400 mt-1 leading-snug">
                  💡 <strong>Custom Category:</strong> Yahan aap jo bhi custom naam likhenge (jaise <span className="text-orange-400">Momos</span>, <span className="text-orange-400">Chai</span>, <span className="text-orange-400">Pasta</span>), wo live menu aur customer page par automatically naya category filter pill ban jayega!
                </p>
              </div>

              {/* Price & Veg Selector */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="250"
                    value={dishPrice}
                    onChange={(e) => setDishPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    placeholder="290"
                    value={dishOriginalPrice}
                    onChange={(e) => setDishOriginalPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Food Type</label>
                  <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setDishIsVeg(true)}
                      className={`flex-1 text-[11px] font-bold py-1 rounded-lg transition ${
                        dishIsVeg ? "bg-emerald-600 text-white" : "text-slate-400"
                      }`}
                    >
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setDishIsVeg(false)}
                      className={`flex-1 text-[11px] font-bold py-1 rounded-lg transition ${
                        !dishIsVeg ? "bg-rose-600 text-white" : "text-slate-400"
                      }`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>
              </div>

              {/* Bestseller Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bestsellerCheck"
                  checked={dishIsBestseller}
                  onChange={(e) => setDishIsBestseller(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded bg-slate-950 border-slate-800"
                />
                <label htmlFor="bestsellerCheck" className="text-slate-300 font-bold cursor-pointer">
                  Mark as Bestseller / Chef's Recommendation 🔥
                </label>
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Description / Recipe</label>
                <textarea
                  rows={2}
                  placeholder="Fresh oven-baked mozzarella cheese, basil & oregano on crispy crust..."
                  value={dishDescription}
                  onChange={(e) => setDishDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Custom Variants & Add-ons (e.g. Extra Cheese, Half/Full size) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <span>✨ Custom Add-ons & Variants (Optional)</span>
                  </label>
                  <span className="text-[10px] text-orange-400 font-semibold">Zomato Style</span>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Dish ke sath custom options add karein (jaise Extra Cheese, Full Size, Spicy Sauce).
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Variant name (e.g. Extra Cheese / Full Plate)"
                    value={addonInputName}
                    onChange={(e) => setAddonInputName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-xs"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      placeholder="Extra ₹"
                      value={addonInputPrice}
                      onChange={(e) => setAddonInputPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-6 pr-2 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomAddon}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shrink-0 shadow-md shadow-orange-600/20"
                  >
                    + Add
                  </button>
                </div>

                {/* Added variants pills */}
                {dishAddons.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {dishAddons.map((addon, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-900 border border-orange-500/40 text-orange-200 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{addon.name}</span>
                        <span className="text-emerald-400 font-black">+₹{addon.price}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAddon(idx)}
                          className="text-slate-400 hover:text-rose-400 ml-1 text-sm font-black cursor-pointer leading-none"
                          title="Remove variant"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">
                    Koi variant add nahi hua hai. Aap 'Extra Cheese (+₹40)' ya 'Large Size (+₹70)' add kar sakte hain.
                  </p>
                )}
              </div>

              {/* Multi-Photo Cloudflare R2 Upload */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Food Photos (Upload Multiple for Carousel)
                </label>
                <label className="w-full bg-slate-950 hover:bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition">
                  {dishUploading ? (
                    <div className="flex items-center gap-2 text-xs text-orange-400 font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading to Cloudflare R2 CDN...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-300">
                      <div className="flex items-center gap-2 font-bold text-orange-400">
                        <UploadCloud className="w-4 h-4" />
                        <span>Click to Select Single or Multiple Photos</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Zero Egress CDN • Cloudflare R2 Storage
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={dishUploading}
                    onChange={handleDishUpload}
                    className="hidden"
                  />
                </label>

                {/* Uploaded Carousel Thumbnails */}
                {dishImages.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-white">Uploaded Photos ({dishImages.length})</span>
                      <span className="text-emerald-400 font-semibold">Carousel Enabled</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1.5 bg-slate-950 rounded-xl border border-slate-800">
                      {dishImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative group rounded-lg overflow-hidden border border-slate-800 aspect-square"
                        >
                          <img src={img} alt="Dish" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeDishImage(idx)}
                            className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow transition"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-0.5 left-0.5 bg-black/70 text-[9px] text-white px-1 rounded font-bold">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDishModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dishUploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black px-5 py-2 rounded-xl transition shadow-lg shadow-orange-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingDishId ? "Update Dish" : "Save & Publish Dish"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
