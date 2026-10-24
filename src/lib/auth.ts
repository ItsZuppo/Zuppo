import type { User as SupabaseUser } from "@supabase/supabase-js";
import crypto from "crypto";
import { cookies } from "next/headers";
import { authBackend } from "./authBackend";

export interface AuthUser {
  id: string;
  role: "partner" | "rider" | "customer" | "admin";
  name: string;
  phone?: string;
  email?: string;
  restaurantId?: string; // Strictly bound for partner
  restaurantName?: string;
  vehicle?: string;
  developmentOnly?: boolean;
  issuedAt?: number;
  avatarUrl?: string;
  savedAddresses?: {id:string;label:string;address:string;lat:number;lng:number}[];
  defaultAddressId?: string;
}

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return secret;
}
export const SESSION_COOKIE_NAME = "ambibite_auth_session";

// 1. Built-in Credentials for Existing Ambikapur Kitchens
export const KITCHEN_CREDENTIALS = [
  {
    restaurantId: "11111111-1111-1111-1111-111111111111",
    restaurantName: "The Royal Kitchen",
    username: "royal",
    email: "royal@ambibite.com",
    password: "royal123",
    phone: "+91 98261 44551",
    area: "Gandhi Chowk",
  },
  {
    restaurantId: "22222222-2222-2222-2222-222222222222",
    restaurantName: "Burger Hub & Cafe",
    username: "burger",
    email: "burger@ambibite.com",
    password: "burger123",
    phone: "+91 70002 99120",
    area: "Ghadi Chowk",
  },
  {
    restaurantId: "33333333-3333-3333-3333-333333333333",
    restaurantName: "Ambikapur Dosa Plaza",
    username: "dosa",
    email: "dosa@ambibite.com",
    password: "dosa123",
    phone: "+91 94252 11029",
    area: "Kedarpur",
  },
  {
    restaurantId: "44444444-4444-4444-4444-444444444444",
    restaurantName: "Kolkata Kathi Rolls Corner",
    username: "rolls",
    email: "rolls@ambibite.com",
    password: "rolls123",
    phone: "+91 99814 77218",
    area: "Ring Road East",
  },
];

// 2. Built-in Rider Credentials
export const RIDER_CREDENTIALS = [
  {
    id: "rider-1",
    username: "rider",
    email: "rider@ambibite.com",
    password: "rider123",
    name: "Rahul Sharma",
    phone: "+91 98261 99001",
    vehicle: "Hero Splendor Plus (CG 15 AB 1002)",
  },
  {
    id: "rider-2",
    username: "amit",
    email: "amit@ambibite.com",
    password: "rider123",
    name: "Amit Toppo",
    phone: "+91 91310 88204",
    vehicle: "Bajaj Pulsar 125 (CG 15 K 4410)",
  },
];

// 3. Admin Credentials
export const ADMIN_CREDENTIALS = {
  id: "admin-master",
  username: "admin",
  email: "admin@ambibite.com",
  password: "admin123",
  name: "Master Admin Ambikapur",
};

// Cryptographic HMAC token signing & verification
export function signSession(user: AuthUser): string {
  const payload = Buffer.from(JSON.stringify({ ...user, issuedAt: Date.now(), exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", authSecret()).update(payload).digest("base64url");
  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (user.developmentOnly && user.role === "customer") return null;
    if (user.developmentOnly && (process.env.NODE_ENV === "production" || process.env.ENABLE_TEMP_LOGIN !== "true")) return null;
    if (!user.id || !["customer", "partner", "rider", "admin"].includes(user.role) || !Number.isFinite(user.exp) || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

// Server-side session getter
export async function getSessionContext(): Promise<{user:AuthUser;record:SupabaseUser|null} | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const user = verifySession(token);
    if (!user) return null;
    if (user.developmentOnly) return {user,record:null};
    const { data, error } = await authBackend().auth.admin.getUserById(user.id);
    if (error || !data.user) return null;
    const changedAt = data.user.app_metadata?.password_changed_at;
    if (typeof changedAt === "number" && (!user.issuedAt || user.issuedAt < changedAt)) return null;
    return {record:data.user,user:{ ...user, name: data.user.user_metadata?.full_name || user.name, phone: data.user.user_metadata?.phone || "", avatarUrl:data.user.user_metadata?.avatar_url || "", savedAddresses:data.user.user_metadata?.saved_addresses || [], defaultAddressId:data.user.user_metadata?.default_address_id || "" }};
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  return (await getSessionContext())?.user || null;
}

// Temporary identities are explicitly local-only and stored as salted hashes in env.
export function temporaryLogin(role: string, username: string, password: string): AuthUser | null {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_TEMP_LOGIN !== "true") return null;
  try {
    const accounts = JSON.parse(Buffer.from(process.env.TEMP_LOGIN_ACCOUNTS || "", "base64").toString("utf8")) as Array<{role: AuthUser["role"]; username: string; id: string; salt: string; hash: string}>;
    const account = accounts.find(a => a.role === role && a.username === username);
    if (!account) return null;
    const expected = Buffer.from(account.hash, "hex");
    const actual = crypto.scryptSync(password, account.salt, 32);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    return { id: account.id, role: account.role, name: `Temporary ${account.role}`, email: account.username, developmentOnly: true,
      ...(role === "partner" ? { restaurantId: "11111111-1111-1111-1111-111111111111", restaurantName: "The Royal Kitchen" } : {}),
      ...(role === "rider" ? { vehicle: "Local test vehicle" } : {}) };
  } catch { return null; }
}
