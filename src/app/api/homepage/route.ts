import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DEFAULT_HOME_SETTINGS, HomeSettings } from "@/lib/homeSettings";
import { authBackend } from "@/lib/authBackend";
import { getSessionUser } from "@/lib/auth";
import { readHomepage } from "@/lib/homepageServer";
const bucket=process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || "ambibite";
const key="site/homepage.json";
function storage(){const account=process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID;const accessKeyId=process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;const secretAccessKey=process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;if(!account || !accessKeyId || !secretAccessKey)throw Error("Homepage storage is not configured.");return new S3Client({region:"auto",endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId,secretAccessKey}});}
function image(value:string){try{const list=JSON.parse(value);if(Array.isArray(list))return list.find(x=>typeof x==="string"&&x.startsWith("https://")) || "";}catch{}return value?.startsWith("https://")?value:"";}
export async function GET(){
 try {return NextResponse.json({success:true,...await readHomepage()},{headers:{"Cache-Control":"no-store"}});}
 catch {return NextResponse.json({success:false,error:"Homepage settings could not be loaded."},{status:503});}
}
export async function PUT(req:Request){
 const actor=await getSessionUser();if(!actor || actor.role!=="admin")return NextResponse.json({success:false,error:"Admin access required."},{status:actor?403:401});
 try{const b=await req.json();if(typeof b.announcementEnabled!=="boolean" || typeof b.carouselEnabled!=="boolean" || typeof b.announcement!=="string" || b.announcement.length>160 || !Number.isInteger(b.intervalSeconds) || b.intervalSeconds<3 || b.intervalSeconds>15 || !Array.isArray(b.restaurantIds) || b.restaurantIds.length>20 || b.restaurantIds.some((id:unknown)=>typeof id!=="string" || !/^[a-f0-9-]{36}$/i.test(id)))return NextResponse.json({success:false,error:"Check the announcement (160 characters max), slide timing (3–15 seconds) and selected restaurants."},{status:400});
 const settings:HomeSettings={announcementEnabled:b.announcementEnabled,announcement:b.announcement.trim(),carouselEnabled:b.carouselEnabled,intervalSeconds:b.intervalSeconds,restaurantIds:[...new Set<string>(b.restaurantIds)]};
 await storage().send(new PutObjectCommand({Bucket:bucket,Key:key,Body:JSON.stringify(settings),ContentType:"application/json",CacheControl:"no-cache"}));revalidateTag("homepage-promotions",{expire:0});return NextResponse.json({success:true,settings});
 }catch{return NextResponse.json({success:false,error:"Homepage settings could not be saved."},{status:503});}
}
