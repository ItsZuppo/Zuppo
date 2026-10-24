"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Bike,
  Banknote,
  Search,
  Bell,
  User,
  ToggleRight,
  ToggleLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  PhoneCall,
  Check,
  X,
  ExternalLink,
  DollarSign,
  Download,
  Upload,
  Plus,
  Utensils,
  Image as ImageIcon,
  FileCheck,
  Eye,
} from "lucide-react";

export interface LiveOrderData {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  deliveryArea: string;
  restaurantName: string;
  items: { name: string; qty: number; price: number }[];
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  totalAmount: number;
  paymentMethod: "COD" | "UPI";
  paymentStatus: "pending" | "completed";
  status: "placed" | "preparing" | "ready" | "rider_assigned" | "picked_up" | "delivered" | "cancelled";
  riderName: string | null;
  riderId?: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "restaurants" | "categories" | "verifications" | "riders" | "payouts">("dashboard");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [liveOrders, setLiveOrders] = useState<LiveOrderData[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // State: Dynamic Restaurants from Supabase
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoadingRest, setIsLoadingRest] = useState(false);

  // Modal States: Add Kitchen & Add Dish
  const [isAddKitchenOpen, setIsAddKitchenOpen] = useState(false);
  const [isAddDishOpen, setIsAddDishOpen] = useState(false);

  // New Kitchen Form State
  const [newKitchen, setNewKitchen] = useState({
    name: "",
    cuisine: "North Indian, Mughlai, Biryani",
    area: "Gandhi Chowk",
    address: "",
    phone: "+91 ",
    deliveryTime: "25-30 min",
    commissionPercent: 20,
    bannerUrl: "",
    images: [] as string[],
  });
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // New Dish Form State
  const [newDish, setNewDish] = useState({
    restaurantId: "",
    name: "",
    category: "Main Course",
    price: "",
    originalPrice: "",
    isVeg: true,
    isBestseller: false,
    description: "",
    imageUrl: "",
    images: [] as string[],
  });
  const [isUploadingDishImg, setIsUploadingDishImg] = useState(false);

  // State: Food Categories (Home "What's on your mind?")
  const [categories, setCategories] = useState<any[]>([]);
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [catFormName, setCatFormName] = useState("");
  const [catFormImg, setCatFormImg] = useState("");
  const [isUploadingCatImg, setIsUploadingCatImg] = useState(false);

  // State: KYC & Partner Verifications
  const [verificationKitchens, setVerificationKitchens] = useState<any[]>([]);
  const [verificationRiders, setVerificationRiders] = useState<any[]>([]);
  const [isLoadingVerifications, setIsLoadingVerifications] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<"pending" | "all">("pending");
  const [zoomedDoc, setZoomedDoc] = useState<{ title: string; url: string } | null>(null);

  // State: Riders
  const [riders, setRiders] = useState([
    { id: "rider-1", name: "Rahul Sharma", phone: "+91 98261 99001", vehicle: "Hero Splendor Plus (CG 15 AB 1002)", status: "Available", cashHeld: 0, completedToday: 0, isOnline: true },
    { id: "rider-2", name: "Amit Toppo", phone: "+91 91310 88204", vehicle: "Bajaj Pulsar 125 (CG 15 K 4410)", status: "Available", cashHeld: 0, completedToday: 0, isOnline: true },
  ] as any[]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
    } catch (e) {
      console.warn("Error fetching categories:", e);
    }
  };

  const handleUploadCategoryImg = async (file: File) => {
    setIsUploadingCatImg(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && data.url) {
        setCatFormImg(data.url);
        showToast("Category image uploaded to Cloudflare CDN!");
      } else {
        showToast("Upload failed");
      }
    } catch {
      showToast("Failed to upload image");
    } finally {
      setIsUploadingCatImg(false);
    }
  };

  const handleSaveCategoriesList = async (newList: any[]) => {
    setIsSavingCategories(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: newList }),
      });
      const data = await res.json();
      if (data.success) {
        setCategories(newList);
        showToast("Category changes saved & live on Customer Home!");
      } else {
        showToast("Failed to save categories");
      }
    } catch {
      showToast("Error updating categories");
    } finally {
      setIsSavingCategories(false);
    }
  };

  const handleOpenAddCategory = () => {
    setEditingCatIdx(null);
    setCatFormName("");
    setCatFormImg("");
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any, index: number) => {
    setEditingCatIdx(index);
    setCatFormName(cat.name);
    setCatFormImg(cat.image);
    setIsCatModalOpen(true);
  };

  const handleDeleteCategory = async (index: number) => {
    const targetName = categories[index]?.name || "this category";
    if (!confirm(`Are you sure you want to delete "${targetName}" from Home categories?`)) return;
    const updated = categories.filter((_, idx) => idx !== index);
    await handleSaveCategoriesList(updated);
  };

  const fetchRestaurants = async () => {
    setIsLoadingRest(true);
    try {
      const res = await fetch("/api/restaurants");
      const data = await res.json();
      if (data.success && data.restaurants) {
        setRestaurants(data.restaurants);
      }
    } catch (e) {
      console.warn("Error fetching restaurants:", e);
    } finally {
      setIsLoadingRest(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await fetch("/api/menu");
      const data = await res.json();
      if (data.success && data.menuItems) {
        setMenuItems(data.menuItems);
      }
    } catch (e) {
      console.warn("Error fetching menu items:", e);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success && data.orders) {
        setLiveOrders(data.orders);
      }
    } catch (e) {
      console.warn("Error fetching live orders:", e);
    }
  };

  const fetchVerifications = async () => {
    setIsLoadingVerifications(true);
    try {
      const res = await fetch("/api/admin/verifications");
      const data = await res.json();
      if (data.success) {
        setVerificationKitchens(data.kitchens || []);
        setVerificationRiders(data.riders || []);
      }
    } catch (e) {
      console.warn("Error fetching verifications:", e);
    } finally {
      setIsLoadingVerifications(false);
    }
  };

  const handleActionVerification = async (
    type: "partner" | "rider",
    id: string,
    action: "approve" | "reject"
  ) => {
    let rejectReason = "";
    if (action === "reject") {
      const input = prompt("Please provide reason for rejection (sent to partner):");
      if (input === null) return;
      rejectReason = input.trim() || "Documents need re-upload";
    }

    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, action, rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        fetchVerifications();
        fetchRestaurants();
      } else {
        showToast(data.error || "Action failed");
      }
    } catch (e: any) {
      showToast("Verification error: " + e.message);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRestaurants();
    fetchMenuItems();
    fetchCategories();
    fetchVerifications();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  // Upload to Cloudflare R2 (Single or Multiple Photos)
  const handleUploadImages = async (files: FileList | File[], type: "kitchen" | "dish") => {
    if (!files || files.length === 0) return;
    if (type === "kitchen") setIsUploadingBanner(true);
    else setIsUploadingDishImg(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      formData.append("folder", type === "kitchen" ? "restaurants" : "food");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && (data.urls || data.url)) {
        const uploaded = data.urls || [data.url];
        if (type === "kitchen") {
          setNewKitchen((prev) => ({
            ...prev,
            bannerUrl: prev.bannerUrl || uploaded[0],
            images: [...prev.images, ...uploaded],
          }));
        } else {
          setNewDish((prev) => ({
            ...prev,
            imageUrl: prev.imageUrl || uploaded[0],
            images: [...prev.images, ...uploaded],
          }));
        }
        showToast(`✅ ${uploaded.length} photo(s) uploaded to Cloudflare R2!`);
      } else {
        showToast(`Upload failed: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      showToast(`Upload error: ${e.message}`);
    } finally {
      if (type === "kitchen") setIsUploadingBanner(false);
      else setIsUploadingDishImg(false);
    }
  };

  const removeKitchenImage = (idxToRemove: number) => {
    setNewKitchen((prev) => {
      const nextImgs = prev.images.filter((_, idx) => idx !== idxToRemove);
      return {
        ...prev,
        images: nextImgs,
        bannerUrl: nextImgs[0] || "",
      };
    });
  };

  const removeDishImage = (idxToRemove: number) => {
    setNewDish((prev) => {
      const nextImgs = prev.images.filter((_, idx) => idx !== idxToRemove);
      return {
        ...prev,
        images: nextImgs,
        imageUrl: nextImgs[0] || "",
      };
    });
  };

  // Submit New Kitchen to Supabase
  const handleCreateKitchen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitchen.name) {
      showToast("Please enter kitchen name");
      return;
    }

    try {
      const res = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKitchen),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎉 ${newKitchen.name} onboarded to Ambikapur network!`);
        setIsAddKitchenOpen(false);
        setNewKitchen({
          name: "",
          cuisine: "North Indian, Mughlai, Biryani",
          area: "Gandhi Chowk",
          address: "",
          phone: "+91 ",
          deliveryTime: "25-30 min",
          commissionPercent: 20,
          bannerUrl: "",
          images: [],
        });
        fetchRestaurants();
      } else {
        showToast(`Failed: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
  };

  // Submit New Dish to Supabase
  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDish.name || !newDish.price) {
      showToast("Please enter dish name and price");
      return;
    }

    const restId = newDish.restaurantId || restaurants[0]?.id || "11111111-1111-1111-1111-111111111111";

    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newDish, restaurantId: restId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🍲 Dish ${newDish.name} added to menu & saved to Cloudflare!`);
        setIsAddDishOpen(false);
        setNewDish({
          restaurantId: "",
          name: "",
          category: "Main Course",
          price: "",
          originalPrice: "",
          isVeg: true,
          isBestseller: false,
          description: "",
          imageUrl: "",
          images: [],
        });
        fetchMenuItems();
      } else {
        showToast(`Failed: ${data.error}`);
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`);
    }
  };

  const assignRiderToOrder = async (orderId: string, orderNumber: string, riderId: string) => {
    const rider = riders.find((r) => r.id === riderId);
    if (!rider) return;
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          status: "rider_assigned",
          riderId: rider.id,
          riderName: rider.name,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Rider ${rider.name} assigned to Order ${orderNumber}!`);
        fetchOrders();
      } else {
        showToast(`Failed: ${data.error}`);
      }
    } catch (e) {
      showToast(`Error assigning rider: ${e}`);
    }
  };

  const toggleRestaurantStatus = async (id: string, currentIsOpen: boolean) => {
    try {
      const newStatus = !currentIsOpen;
      await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_open: newStatus }),
      });
      showToast(`Store status updated to ${newStatus ? "Open" : "Closed"}`);
      fetchRestaurants();
    } catch (e) {
      showToast("Error updating store status");
    }
  };

  const toggleRestaurantBlock = async (id: string, currentBlocked: boolean) => {
    try {
      const newBlocked = !currentBlocked;
      await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_blocked: newBlocked }),
      });
      showToast(newBlocked ? "Store blocked from accepting orders" : "Store unblocked");
      fetchRestaurants();
    } catch (e) {
      showToast("Error toggling store block");
    }
  };

  const collectRiderCash = (riderId: number, name: string, currentHeld: number) => {
    setRiders((prev) =>
      prev.map((r) => (r.id === riderId ? { ...r, cashHeld: 0 } : r))
    );
    showToast(`Physical cash ₹${currentHeld} collected from ${name}. Digital ledger reset to ₹0!`);
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case "placed":
        return { label: "Incoming Kitchen", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
      case "preparing":
        return { label: "Kitchen Preparing", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
      case "ready":
        return { label: "Food Ready", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
      case "rider_assigned":
        return { label: "Rider Assigned", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" };
      case "picked_up":
        return { label: "In Transit", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" };
      case "delivered":
        return { label: "Delivered", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
      case "cancelled":
      case "rejected":
        return { label: "Rider Rejected", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
      default:
        return { label: status, color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
    }
  };

  const liveOrdersCount = liveOrders.filter((o) => o.status !== "delivered").length;
  const pendingApprovalsCount =
    verificationKitchens.filter((k) => k.isBlocked).length +
    verificationRiders.filter((r) => r.status === "pending_verification").length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Live Orders", icon: ShoppingBag, badge: `${liveOrdersCount} Live` },
    {
      id: "verifications",
      label: "KYC & Approvals",
      icon: FileCheck,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} Pending` : undefined,
    },
    { id: "restaurants", label: "Restaurants", icon: Store, count: `${restaurants.length}` },
    { id: "categories", label: "Food Categories", icon: Utensils, count: `${categories.length}` },
    { id: "riders", label: "Rider Fleet", icon: Bike, count: `${riders.filter((r) => r.isOnline).length} Online` },
    { id: "payouts", label: "Weekly Payouts", icon: Banknote },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans antialiased">

      {/* Toast Banner Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-orange-600 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar - Sleek Dark Control Center */}
      <aside className="w-64 sticky top-0 h-[calc(100dvh-48px)] overflow-y-auto bg-slate-950 border-r border-slate-800 flex flex-col justify-between hidden lg:flex shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-6 border-b border-slate-800/80">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-9 h-9 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-orange-600/30">
                A
              </span>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white group-hover:text-orange-400 transition">
                  AmbiBites
                </h1>
                <p className="text-[10px] text-orange-400 font-extrabold uppercase tracking-wider">
                  Master Control
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-xs transition duration-200 cursor-pointer ${isActive
                      ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {item.count && (
                    <span className="text-[10px] text-slate-500 font-bold">{item.count}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Portal Switch Links */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-wider">Quick Jump</p>
          <div className="flex flex-col gap-1 text-xs font-semibold">
            <Link href="/" className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-between transition">
              <span>Customer Home</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            <Link href="/partner" className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-between transition">
              <span>Restaurant Partner</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </Link>
            <Link href="/rider" className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 flex items-center justify-between transition">
              <span>Rider Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            </Link>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black text-white shadow-md text-xs">
              AG
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate">Aryan Gupta</h4>
              <p className="text-[10px] text-slate-400 truncate">Super Admin (Ambikapur)</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </aside>

      {/* Main Command Surface */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0 overflow-y-auto">

        <nav aria-label="Admin sections" className="portal-mobile-tabs lg:hidden">
          {navItems.map(item => <button key={item.id} aria-current={activeTab === item.id ? "page" : undefined} onClick={() => setActiveTab(item.id as typeof activeTab)}>{item.label}</button>)}
        </nav>
        {/* Top Navbar */}
        <header className="h-16 px-6 lg:px-8 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search orders, restaurants, riders or customer mobile..."
                className="w-full bg-slate-900/90 border border-slate-800 pl-10 pr-4 py-2 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => showToast("All system webhooks synced with Supabase")}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Sync DB</span>
            </button>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ambikapur Grid Online</span>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Navigation Tabs (Visible on < md screens) */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto p-3 bg-slate-950 border-b border-slate-800 scrollbar-none sticky top-16 z-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                  isActive
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.id === "orders" && liveOrdersCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                )}
              </button>
            );
          })}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 whitespace-nowrap shrink-0"
          >
            <span>Customer View →</span>
          </Link>
        </div>

        {/* Dynamic Content Views based on activeTab */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 pb-24">

          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">System Control Matrix</h2>
                <p className="text-xs text-slate-400 mt-0.5">Real-time status of orders, food outlets, and active delivery partners in Ambikapur.</p>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                {[
                  { title: "Active Orders", val: `${liveOrders.length}`, change: `${liveOrdersCount} in Kitchen / Transit`, icon: ShoppingBag, color: "from-orange-600 to-amber-600" },
                  { title: "Gross GMV", val: `₹${liveOrders.reduce((sum, o) => sum + o.totalAmount, 0)}`, change: "Ambikapur Live Stream", icon: TrendingUp, color: "from-emerald-600 to-teal-600" },
                  { title: "Rider Cash Held", val: `₹${riders.reduce((sum, r) => sum + r.cashHeld, 0)}`, change: "Under ₹2,000 threshold", icon: Banknote, color: "from-blue-600 to-indigo-600" },
                  { title: "Online Riders", val: `${riders.filter(r => r.isOnline).length} Active`, change: "Available for Dispatch", icon: Bike, color: "from-purple-600 to-pink-600" },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-slate-950 p-5 rounded-3xl border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.title}</span>
                        <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${stat.color} text-white shadow-md`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tight">{stat.val}</h3>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                        {stat.change}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Live Orders & Rider Fleet Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Live Orders Queue (Col span 2) */}
                <div className="lg:col-span-2 bg-slate-950 rounded-3xl p-6 border border-slate-800">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="text-base font-black text-white">Live Dispatched Orders</h3>
                      <p className="text-xs text-slate-500">Live webhook synchronised with Razorpay & Rider fleet</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs font-bold text-orange-400 hover:underline"
                    >
                      View All Orders ({liveOrders.length}) →
                    </button>
                  </div>

                  <div className="space-y-3">
                    {liveOrders.slice(0, 4).map((o) => {
                      const badge = getOrderStatusBadge(o.status);
                      return (
                        <div key={o.id} className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 transition">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 font-black text-white text-xs flex items-center justify-center">
                              {o.orderNumber.replace("#AB-", "")}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-white">{o.restaurantName}</h4>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                To: <strong className="text-slate-300">{o.customerName} ({o.deliveryArea.split(",")[0]})</strong> • Rider: <span className="text-orange-400 font-semibold">{o.riderName || "Pending Assign"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-sm font-black text-white">₹{o.totalAmount}</span>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold">{o.paymentMethod}</span>
                            </div>
                            {o.status !== "delivered" && (
                              <button
                                onClick={() => setActiveTab("orders")}
                                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow transition"
                              >
                                {o.riderName ? "Manage" : "Assign Rider"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {liveOrders.length === 0 && (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No orders in queue. Place an order in customer view to see live dispatch!
                      </div>
                    )}
                  </div>
                </div>

                {/* Rider Fleet Status Tracker */}
                <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-black text-white">Active Riders</h3>
                    <button
                      onClick={() => setActiveTab("riders")}
                      className="text-xs font-bold text-orange-400 hover:underline"
                    >
                      Fleet Control →
                    </button>
                  </div>

                  <div className="space-y-4">
                    {riders.slice(0, 3).map((rider, index) => (
                      <div key={index} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center font-bold">
                                <Bike className="w-5 h-5" />
                              </div>
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900 absolute -bottom-0.5 -right-0.5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-white">{rider.name}</h4>
                              <p className="text-[11px] text-slate-400">{rider.status}</p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-emerald-400">
                            ₹{rider.cashHeld}
                          </span>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Limit: <strong className="text-slate-300">₹2,000 max</strong></span>
                          <button
                            onClick={() => showToast(`Simulated ping alert sent to ${rider.name} (${rider.phone})`)}
                            className="text-orange-400 hover:underline font-bold"
                          >
                            Ping Rider
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: LIVE ORDERS MANAGEMENT */}
          {activeTab === "orders" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Live Orders Master Queue</h2>
                  <p className="text-xs text-slate-400">Monitor all customer orders placed across Ambikapur in real-time ({liveOrders.length} active).</p>
                </div>
                <button
                  onClick={() => {
                    fetchOrders();
                    showToast("Order queue refreshed from live network!");
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Queue</span>
                </button>
              </div>

              <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold bg-slate-900/60">
                        <th className="py-4 px-4">Order ID</th>
                        <th className="py-4 px-4">Restaurant</th>
                        <th className="py-4 px-4">Customer & Location</th>
                        <th className="py-4 px-4">Rider</th>
                        <th className="py-4 px-4">Amount</th>
                        <th className="py-4 px-4">Status</th>
                        <th className="py-4 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {liveOrders.map((ord) => {
                        const badge = getOrderStatusBadge(ord.status);
                        return (
                          <tr key={ord.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-4 px-4 font-black text-orange-400">{ord.orderNumber}</td>
                            <td className="py-4 px-4 font-bold text-white">{ord.restaurantName}</td>
                            <td className="py-4 px-4">
                              <span className="font-bold text-white block">{ord.customerName}</span>
                              <span className="text-slate-400 text-[11px] block">{ord.deliveryArea}</span>
                              {ord.customerPhone && (
                                <span className="text-slate-500 text-[10px]">{ord.customerPhone}</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {ord.riderName ? (
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                  <Bike className="w-3.5 h-3.5 text-orange-400" />
                                  <span>{ord.riderName}</span>
                                </span>
                              ) : (
                                <span className="text-amber-400/80 font-semibold italic text-[11px]">Unassigned</span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-black text-white">
                              <div>₹{ord.totalAmount}</div>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{ord.paymentMethod}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                {ord.status !== "delivered" && ord.status !== "picked_up" && (
                                  <select
                                    value={ord.riderId || ""}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        assignRiderToOrder(ord.id, ord.orderNumber, e.target.value);
                                      }
                                    }}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-1.5 px-2.5 rounded-xl cursor-pointer border border-orange-500 outline-none"
                                  >
                                    <option value="" disabled>
                                      {ord.riderName ? `Assigned: ${ord.riderName}` : "Assign Rider →"}
                                    </option>
                                    {riders.filter((r) => r.isOnline).map((r) => (
                                      <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {ord.status === "picked_up" && (
                                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-xl font-bold text-[11px]">
                                    Out for Delivery
                                  </span>
                                )}
                                {ord.status === "delivered" && (
                                  <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> Completed
                                  </span>
                                )}
                                <button
                                  onClick={() => showToast(`Dialling customer ${ord.customerName} (${ord.customerPhone || "Ambikapur"})...`)}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-xl transition text-[11px] font-bold"
                                >
                                  Call
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {liveOrders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                            No active orders right now. Place an order in customer portal to simulate!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESTAURANTS MANAGEMENT */}
          {activeTab === "restaurants" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Partner Restaurants (Ambikapur)</h2>
                  <p className="text-xs text-slate-400">
                    Live database synced with Supabase & Cloudflare R2 CDN. ({restaurants.length} kitchens active).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddDishOpen(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                  >
                    <Utensils className="w-3.5 h-3.5 text-orange-400" />
                    <span>+ Add Dish</span>
                  </button>
                  <button
                    onClick={() => setIsAddKitchenOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add New Kitchen</span>
                  </button>
                </div>
              </div>

              {isLoadingRest && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Loading live restaurants from Supabase...
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {restaurants.map((rest) => {
                  const restDishes = menuItems.filter((m) => m.restaurant_id === rest.id);
                  return (
                    <div key={rest.id} className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden space-y-4">
                      {/* Restaurant Banner Photo from Cloudflare R2 */}
                      <div className="relative h-36 w-full bg-slate-900 overflow-hidden">
                        <img
                          src={rest.banner_url || "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/restaurants/the_royal_kitchen.jpg"}
                          alt={rest.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-orange-600/90 text-white px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                            {rest.delivery_time_text || "25-30 min"}
                          </span>
                          <span className="text-xs font-black text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded-md border border-amber-400/30">
                            ★ {rest.rating || 4.5}
                          </span>
                        </div>
                      </div>

                      <div className="px-5 pb-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-base text-white">{rest.name}</h3>
                              {rest.is_blocked && (
                                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black px-2 py-0.5 rounded-md">
                                  BLOCKED
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{rest.area} • Phone: {rest.phone}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{rest.cuisine}</p>
                          </div>

                          <button
                            onClick={() => toggleRestaurantStatus(rest.id, rest.is_open)}
                            className="flex items-center gap-1.5 transition"
                          >
                            {rest.is_open ? (
                              <ToggleRight className="w-8 h-8 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-600" />
                            )}
                            <span className={`text-xs font-bold ${rest.is_open ? "text-emerald-400" : "text-slate-500"}`}>
                              {rest.is_open ? "Open" : "Closed"}
                            </span>
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-2xl border border-slate-800 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">Commission</span>
                            <span className="font-black text-orange-400">{rest.commission_percent || 20}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">Menu Items</span>
                            <span className="font-black text-white">{restDishes.length} Dishes</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block font-bold">Payout Mode</span>
                            <span className="font-black text-emerald-400">Weekly UPI</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <Link
                            href={`/restaurant/${rest.slug || "the-royal-kitchen"}`}
                            className="text-xs font-bold text-orange-400 hover:underline flex items-center gap-1"
                          >
                            <span>View Live Menu</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          <div className="space-x-2">
                            <button
                              onClick={() => {
                                setNewDish((prev) => ({ ...prev, restaurantId: rest.id }));
                                setIsAddDishOpen(true);
                              }}
                              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition"
                            >
                              + Add Item
                            </button>
                            <button
                              onClick={() => toggleRestaurantBlock(rest.id, rest.is_blocked)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                                rest.is_blocked
                                  ? "bg-emerald-600 text-white border-emerald-500"
                                  : "bg-slate-900 text-rose-400 border-rose-500/30 hover:bg-rose-950/40"
                              }`}
                            >
                              {rest.is_blocked ? "Unblock" : "Block Store"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: RIDERS FLEET CONTROL */}
          {activeTab === "riders" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Rider Fleet & COD Ledger Lockout</h2>
                  <p className="text-xs text-slate-400">
                    Enforces the Blueprint's Reverse-Ledger Loop (Riders locked out if cash held exceeds ₹2,000).
                  </p>
                </div>
                <button
                  onClick={() => showToast("Rider registration form opened")}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow"
                >
                  + Onboard Rider
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {riders.map((r) => {
                  const isNearLimit = r.cashHeld >= 1000;
                  const isLocked = r.cashHeld >= 2000;
                  return (
                    <div key={r.id} className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-orange-600/20 text-orange-400 flex items-center justify-center font-bold">
                            <Bike className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-black text-base text-white">{r.name}</h3>
                              <span className={`w-2 h-2 rounded-full ${r.isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{r.phone} • {r.vehicle}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${isLocked
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : isNearLimit
                              ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          }`}>
                          {isLocked ? "LOCKOUT ACTIVE" : isNearLimit ? "NEAR THRESHOLD" : "ACTIVE"}
                        </span>
                      </div>

                      {/* Cash Held Meter */}
                      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-semibold">Physical Cash Held</span>
                          <span className="text-base font-black text-white">₹{r.cashHeld} <span className="text-xs text-slate-500">/ ₹2,000 max</span></span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isLocked ? "bg-rose-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                            style={{ width: `${Math.min(100, (r.cashHeld / 2000) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Cash Handover Button */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-slate-400 font-semibold">
                          Completed: <strong className="text-white">{r.completedToday} trips</strong>
                        </span>

                        <button
                          onClick={() => collectRiderCash(r.id, r.name, r.cashHeld)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
                        >
                          <Banknote className="w-4 h-4" />
                          <span>Cash Received Handover (Reset)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: FOOD CATEGORIES & CRAVINGS */}
          {activeTab === "categories" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <Utensils className="w-6 h-6 text-orange-500" />
                    <span>Food Categories & Cravings Management</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage the "What's on your mind?" circular category icons on Customer Homepage. Upload photos to Cloudflare R2 CDN and edit names.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (confirm("Reset categories back to standard Ambikapur defaults?")) {
                        fetch("/api/categories")
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.categories) handleSaveCategoriesList(d.categories);
                          });
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
                  >
                    Refresh List
                  </button>
                  <button
                    onClick={handleOpenAddCategory}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Category</span>
                  </button>
                </div>
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id || cat.name + idx}
                    className="bg-slate-950 p-5 rounded-3xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between group shadow-sm"
                  >
                    <div className="flex flex-col items-center text-center space-y-3">
                      {/* Circle Preview matching Home Screen */}
                      <div className="w-24 h-24 rounded-full overflow-hidden p-1 ring-2 ring-orange-500/40 group-hover:ring-orange-500 transition shadow-lg relative bg-slate-900">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-full h-full object-cover rounded-full group-hover:scale-105 transition"
                        />
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-white">{cat.name}</h4>
                        <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block mt-0.5">
                          Position #{idx + 1}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 truncate max-w-full font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800/80">
                        {cat.image}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
                      <button
                        onClick={() => handleOpenEditCategory(cat, idx)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-3 rounded-xl border border-slate-800 transition"
                      >
                        Edit / Photo
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(idx)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold py-2 px-3 rounded-xl border border-rose-500/20 transition"
                        title="Delete category"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: KYC & ONBOARDING APPROVALS */}
          {activeTab === "verifications" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                    <FileCheck className="w-6 h-6 text-orange-500" />
                    <span>KYC Onboarding & Verification Station</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Review incoming restaurant partners and rider applications in Ambikapur. Verify FSSAI, PAN, Aadhaar, and Driving Licenses before granting live access.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVerificationFilter(verificationFilter === "pending" ? "all" : "pending")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                      verificationFilter === "pending"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
                    }`}
                  >
                    {verificationFilter === "pending" ? "Showing Pending Only" : "Showing All Applications"}
                  </button>
                  <button
                    onClick={fetchVerifications}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Refresh verifications"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 1. RESTAURANT PARTNERS KYC SECTION */}
              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-black text-white">Restaurant Kitchen Applications</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {verificationKitchens.filter((k) => (verificationFilter === "pending" ? k.isBlocked : true)).length} Kitchens Listed
                  </span>
                </div>

                {verificationKitchens.filter((k) => (verificationFilter === "pending" ? k.isBlocked : true)).length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No Pending Kitchen Applications</p>
                    <p className="text-xs text-slate-500">All registered restaurants in Ambikapur are verified and active.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {verificationKitchens
                      .filter((k) => (verificationFilter === "pending" ? k.isBlocked : true))
                      .map((k) => (
                        <div
                          key={k.id}
                          className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-4"
                        >
                          {/* Top Row: Basic Info */}
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-orange-400 font-black text-base flex items-center justify-center shrink-0">
                                {k.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-base text-white">{k.name}</h4>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                      k.isBlocked
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    }`}
                                  >
                                    {k.isBlocked ? "Pending Verification" : "Active & Live"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {k.area} • {k.cuisine} • Owner: <strong className="text-slate-300">{k.ownerName}</strong> ({k.phone}) • Email: <span className="text-slate-400 font-mono">{k.ownerEmail}</span>
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              {k.isBlocked ? (
                                <>
                                  <button
                                    onClick={() => handleActionVerification("partner", k.id, "approve")}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>Approve & Activate</span>
                                  </button>
                                  <button
                                    onClick={() => handleActionVerification("partner", k.id, "reject")}
                                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs px-3.5 py-2 rounded-xl transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleActionVerification("partner", k.id, "reject")}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Documents Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">FSSAI License</span>
                              <strong className="text-white text-xs block font-mono mt-0.5">{k.fssaiNumber || "Not Provided"}</strong>
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">PAN Card</span>
                                <strong className="text-white text-xs block font-mono mt-0.5">{k.panNumber || "Not Provided"}</strong>
                              </div>
                              {k.panDocUrl ? (
                                <button
                                  onClick={() => setZoomedDoc({ title: `${k.name} - PAN Card Photo`, url: k.panDocUrl })}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 transition"
                                  title="View PAN Card photo"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Doc</span>
                              )}
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Aadhaar Card</span>
                                <strong className="text-white text-xs block font-mono mt-0.5">{k.aadhaarNumber || "Not Provided"}</strong>
                              </div>
                              {k.aadhaarDocUrl ? (
                                <button
                                  onClick={() => setZoomedDoc({ title: `${k.name} - Aadhaar Card Photo`, url: k.aadhaarDocUrl })}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 transition"
                                  title="View Aadhaar Card photo"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Doc</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 2. RIDERS FLEET KYC SECTION */}
              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Bike className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-black text-white">Rider Fleet Applications</h3>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {verificationRiders.filter((r) => (verificationFilter === "pending" ? r.status === "pending_verification" : true)).length} Riders Registered
                  </span>
                </div>

                {verificationRiders.filter((r) => (verificationFilter === "pending" ? r.status === "pending_verification" : true)).length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No Pending Rider Applications</p>
                    <p className="text-xs text-slate-500">All riders in Ambikapur fleet are verified.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {verificationRiders
                      .filter((r) => (verificationFilter === "pending" ? r.status === "pending_verification" : true))
                      .map((r) => (
                        <div
                          key={r.id}
                          className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-black text-base flex items-center justify-center shrink-0">
                                {r.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-base text-white">{r.name}</h4>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                      r.status === "pending_verification"
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    }`}
                                  >
                                    {r.status === "pending_verification" ? "Pending Review" : "Active Fleet"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Vehicle: <strong className="text-slate-300">{r.vehicle}</strong> • Mobile: <span className="text-slate-300">{r.phone}</span> • Email: <span className="font-mono text-slate-400">{r.email}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {r.status === "pending_verification" ? (
                                <>
                                  <button
                                    onClick={() => handleActionVerification("rider", r.id, "approve")}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>Approve & Grant Fleet</span>
                                  </button>
                                  <button
                                    onClick={() => handleActionVerification("rider", r.id, "reject")}
                                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs px-3.5 py-2 rounded-xl transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleActionVerification("rider", r.id, "reject")}
                                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition"
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Documents Row */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Driving License (DL)</span>
                                <strong className="text-white text-xs block font-mono mt-0.5">{r.dlNumber || "Not Provided"}</strong>
                              </div>
                              {r.dlDocUrl ? (
                                <button
                                  onClick={() => setZoomedDoc({ title: `${r.name} - Driving License`, url: r.dlDocUrl })}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 transition"
                                  title="View Driving License"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Doc</span>
                              )}
                            </div>

                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider block">Aadhaar Card</span>
                                <strong className="text-white text-xs block font-mono mt-0.5">{r.aadhaarNumber || "Not Provided"}</strong>
                              </div>
                              {r.aadhaarDocUrl ? (
                                <button
                                  onClick={() => setZoomedDoc({ title: `${r.name} - Aadhaar Card`, url: r.aadhaarDocUrl })}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 transition"
                                  title="View Aadhaar Card"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Doc</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: WEEKLY PAYOUTS (BLUEPRINT COMPLIANT) */}
          {activeTab === "payouts" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Monday Weekly Payout Engine</h2>
                  <p className="text-xs text-slate-400">
                    Following Blueprint Page 7 & 12: Real money stays in your bank until Monday UPI payouts to avoid RBI wallet regulations.
                  </p>
                </div>
                <button
                  onClick={() => showToast("CA Tax & Ledger Report downloaded (CSV)")}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CA Report</span>
                </button>
              </div>

              <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 space-y-4">
                <h3 className="text-base font-black text-white">Pending Monday UPI Transfers</h3>

                <div className="space-y-3">
                  {[
                    { recipient: "The Royal Kitchen (Gandhi Chowk)", type: "Restaurant 80% Cut", upi: "royalkitchen@oksbi", due: "₹18,420" },
                    { recipient: "Burger Hub (Ghadi Chowk)", type: "Restaurant 80% Cut", upi: "burgerhub@axl", due: "₹11,350" },
                    { recipient: "Ramesh Kumar (Rider)", type: "Rider Delivery Earnings (₹40/trip)", upi: "9826111223@paytm", due: "₹2,640" },
                    { recipient: "Suresh Mandavi (Rider)", type: "Rider Delivery Earnings (₹40/trip)", upi: "7000233445@ybl", due: "₹1,920" },
                  ].map((pay, i) => (
                    <div key={i} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-white">{pay.recipient}</h4>
                        <p className="text-xs text-slate-400">{pay.type} • UPI ID: <strong className="text-slate-300">{pay.upi}</strong></p>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-base font-black text-emerald-400">{pay.due}</span>
                        <button
                          onClick={() => showToast(`Triggered manual UPI transfer of ${pay.due} to ${pay.upi}`)}
                          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-4 py-2 rounded-xl transition shadow"
                        >
                          Pay UPI
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL 1: ADD NEW KITCHEN / RESTAURANT */}
      {isAddKitchenOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">Onboard New Restaurant / Kitchen</h3>
                <p className="text-xs text-slate-400">Add food outlet to Ambikapur network & Cloudflare R2 CDN</p>
              </div>
              <button
                onClick={() => setIsAddKitchenOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKitchen} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Restaurant / Cafe Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Chai & Cafe"
                  value={newKitchen.name}
                  onChange={(e) => setNewKitchen({ ...newKitchen, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Cuisines Offered</label>
                  <input
                    type="text"
                    placeholder="e.g. Fast Food, Coffee, Rolls"
                    value={newKitchen.cuisine}
                    onChange={(e) => setNewKitchen({ ...newKitchen, cuisine: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Ambikapur Area</label>
                  <select
                    value={newKitchen.area}
                    onChange={(e) => setNewKitchen({ ...newKitchen, area: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  >
                    <option value="Gandhi Chowk">Gandhi Chowk</option>
                    <option value="Ghadi Chowk">Ghadi Chowk</option>
                    <option value="Ring Road East">Ring Road East</option>
                    <option value="Hospital Road">Hospital Road</option>
                    <option value="Kedarpur">Kedarpur</option>
                    <option value="Banaras Road">Banaras Road</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98261 00000"
                    value={newKitchen.phone}
                    onChange={(e) => setNewKitchen({ ...newKitchen, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Delivery Time (approx)</label>
                  <input
                    type="text"
                    placeholder="20-25 min"
                    value={newKitchen.deliveryTime}
                    onChange={(e) => setNewKitchen({ ...newKitchen, deliveryTime: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Banner Upload to Cloudflare R2 */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Restaurant Photos (Upload Multiple for Banner Carousel)
                </label>
                <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 text-center bg-slate-950/60 hover:border-orange-500/50 transition">
                  <div className="space-y-2">
                    <Upload className="w-7 h-7 text-orange-400 mx-auto" />
                    <div className="text-slate-300 text-xs font-bold">
                      {isUploadingBanner ? (
                        <span className="text-orange-400 animate-pulse">Uploading Photos to Cloudflare R2...</span>
                      ) : (
                        <span>Click to select single or multiple photos</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block">PNG, JPG or WebP (Zero Egress CDN)</span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingBanner}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadImages(e.target.files, "kitchen");
                      }
                    }}
                    className="mt-2 text-[11px] text-slate-400 cursor-pointer"
                  />
                </div>

                {newKitchen.images.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white">Uploaded Photos ({newKitchen.images.length})</span>
                      <span className="text-emerald-400 font-semibold">Carousel Enabled</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 max-h-32 overflow-y-auto">
                      {newKitchen.images.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800 aspect-video">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeKitchenImage(idx)}
                            className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow transition opacity-90 group-hover:opacity-100"
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

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddKitchenOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingBanner}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Onboard to Ambikapur Network</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW DISH / MENU ITEM */}
      {isAddDishOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">Add Food Dish to Menu</h3>
                <p className="text-xs text-slate-400">Photo will upload to Cloudflare R2 and save to Supabase</p>
              </div>
              <button
                onClick={() => setIsAddDishOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDish} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Select Restaurant *</label>
                <select
                  value={newDish.restaurantId}
                  onChange={(e) => setNewDish({ ...newDish, restaurantId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.area})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Butter Paneer Masala"
                  value={newDish.name}
                  onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="180"
                    value={newDish.price}
                    onChange={(e) => setNewDish({ ...newDish, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Original (₹)</label>
                  <input
                    type="number"
                    placeholder="220"
                    value={newDish.originalPrice}
                    onChange={(e) => setNewDish({ ...newDish, originalPrice: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Main Course"
                    value={newDish.category}
                    onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 py-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newDish.isVeg}
                    onChange={(e) => setNewDish({ ...newDish, isVeg: e.target.checked })}
                    className="w-4 h-4 text-emerald-500 rounded"
                  />
                  <span>Pure Vegetarian (Veg)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newDish.isBestseller}
                    onChange={(e) => setNewDish({ ...newDish, isBestseller: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                  <span>Mark Bestseller</span>
                </label>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Description / Recipe</label>
                <textarea
                  rows={2}
                  placeholder="Delicious cottage cheese cooked in creamy tomato butter gravy..."
                  value={newDish.description}
                  onChange={(e) => setNewDish({ ...newDish, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500"
                />
              </div>

              {/* Dish Photo Upload to Cloudflare R2 */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Food Photos (Upload Multiple for Food Carousel)
                </label>
                <div className="border-2 border-dashed border-slate-800 rounded-2xl p-4 text-center bg-slate-950/60 hover:border-orange-500/50 transition">
                  <div className="space-y-2">
                    <ImageIcon className="w-7 h-7 text-orange-400 mx-auto" />
                    <div className="text-slate-300 text-xs font-bold">
                      {isUploadingDishImg ? (
                        <span className="text-orange-400 animate-pulse">Uploading Photos to Cloudflare R2...</span>
                      ) : (
                        <span>Click to select single or multiple dish photos</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block">PNG, JPG or WebP</span>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingDishImg}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleUploadImages(e.target.files, "dish");
                      }
                    }}
                    className="mt-2 text-[11px] text-slate-400 cursor-pointer"
                  />
                </div>

                {newDish.images.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white">Uploaded Photos ({newDish.images.length})</span>
                      <span className="text-emerald-400 font-semibold">Carousel Enabled</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 max-h-32 overflow-y-auto">
                      {newDish.images.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-800 aspect-square">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeDishImage(idx)}
                            className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-0.5 shadow transition opacity-90 group-hover:opacity-100"
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

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDishOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDishImg}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Dish to Menu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT CATEGORY */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  {editingCatIdx !== null ? "Edit Food Category" : "Add New Food Category"}
                </h3>
                <p className="text-xs text-slate-400">
                  Visible on Customer Homepage "What's on your mind?"
                </p>
              </div>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catFormName.trim()) {
                  showToast("Please enter a category name");
                  return;
                }
                const finalImg =
                  catFormImg.trim() ||
                  "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg";
                let updated: any[];
                if (editingCatIdx !== null && editingCatIdx >= 0) {
                  updated = [...categories];
                  updated[editingCatIdx] = {
                    ...updated[editingCatIdx],
                    name: catFormName.trim(),
                    image: finalImg,
                  };
                } else {
                  updated = [
                    ...categories,
                    {
                      id: `cat-${Date.now()}`,
                      name: catFormName.trim(),
                      image: finalImg,
                    },
                  ];
                }
                await handleSaveCategoriesList(updated);
                setIsCatModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pizzas, Rolls & Wraps, Momos, Pasta"
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Category Image (Circular Icon)
                </label>

                {/* Image Preview */}
                <div className="flex items-center gap-4 mb-3 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="w-16 h-16 rounded-full overflow-hidden p-1 ring-2 ring-orange-500 shrink-0 bg-slate-900">
                    <img
                      src={
                        catFormImg ||
                        "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev/food/special_chicken_dum_biryani.jpg"
                      }
                      alt="Category Preview"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-400 block font-semibold mb-1">
                      Upload from computer to Cloudflare R2 CDN:
                    </span>
                    <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl border border-slate-700 inline-flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5 text-orange-400" />
                      <span>{isUploadingCatImg ? "Uploading to CDN..." : "Choose Image File"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadCategoryImg(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <label className="text-[10px] text-slate-400 block mb-1">
                  Or Paste Direct Image CDN / Unsplash URL:
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={catFormImg}
                  onChange={(e) => setCatFormImg(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-orange-500 text-[11px]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategories || isUploadingCatImg}
                  className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl transition shadow flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingCategories ? "Saving..." : "Save Category"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DOCUMENT PHOTO ZOOM */}
      {zoomedDoc && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-orange-500" />
                <span>{zoomedDoc.title}</span>
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={zoomedDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Open full resolution in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setZoomedDoc(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
              <img
                src={zoomedDoc.url}
                alt={zoomedDoc.title}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>
            <div className="p-3 bg-slate-900 border-t border-slate-800 text-center text-xs text-slate-400">
              Verified on Cloudflare R2 Zero-Egress CDN
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
