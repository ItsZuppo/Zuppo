import BrandLogo from "@/components/BrandLogo";
export default function Loading(){
 return <div role="status" aria-live="polite" className="flex min-h-[65vh] flex-col items-center justify-center gap-4 bg-[#faf7f2] p-8 text-stone-600"><BrandLogo size={64}/><span className="h-6 w-6 animate-spin rounded-full border-2 border-orange-100 border-t-orange-600"/><p className="text-sm font-medium">Opening your page…</p></div>;
}
