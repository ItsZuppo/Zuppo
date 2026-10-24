"use client";
import BrandLogo from "@/components/BrandLogo";
import { useState } from "react";
export default function PortalSession({label, name}: {label: string; name: string}) {
 const [busy, setBusy] = useState(false);
 return <div className="portal-session"><span className="inline-flex items-center"><BrandLogo size={34} /><span className="portal-session-divider">/</span>{label}</span><span className="portal-session-account">{name}<button disabled={busy} onClick={async () => {setBusy(true); try { const res = await fetch("/api/auth/logout", {method:"POST"}); if (!res.ok) throw new Error(); window.location.reload(); } catch {setBusy(false);} }}>{busy ? "Signing out..." : "Sign out"}</button></span></div>;
}
