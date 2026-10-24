import { unstable_cache } from "next/cache";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DEFAULT_HOME_SETTINGS, HomeSettings } from "@/lib/homeSettings";
import { authBackend } from "@/lib/authBackend";
const bucket=process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || "ambibite";
const key="site/homepage.json";
function storage(){const account=process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID;const accessKeyId=process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;const secretAccessKey=process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;if(!account || !accessKeyId || !secretAccessKey)throw Error("Homepage storage is not configured.");return new S3Client({region:"auto",endpoint:`https://${account}.r2.cloudflarestorage.com`,credentials:{accessKeyId,secretAccessKey}});}
function image(value:string){try{const list=JSON.parse(value);if(Array.isArray(list))return list.find(x=>typeof x==="string"&&x.startsWith("https://")) || "";}catch{}return value?.startsWith("https://")?value:"";}
async function loadHomepage(){
  let settings:HomeSettings=DEFAULT_HOME_SETTINGS;
  try{const object=await storage().send(new GetObjectCommand({Bucket:bucket,Key:key}));settings={...DEFAULT_HOME_SETTINGS,...JSON.parse(await object.Body!.transformToString())};}catch(e){if((e as {name?:string}).name!=="NoSuchKey")throw e;}
  const {data,error}=await authBackend().from("restaurants").select("id,slug,name,cuisine,area,banner_url,is_blocked").neq("slug","system-categories").order("created_at");
  if(error)throw error;
  const all=(data || []).filter(r=>!r.is_blocked && image(r.banner_url));
  const selected=settings.restaurantIds.length?settings.restaurantIds.flatMap(id=>all.filter(r=>r.id===id)):all;
  const banners=selected.map(r=>({id:r.id,slug:r.slug,name:r.name,cuisine:r.cuisine,area:r.area,image:image(r.banner_url)}));
  return {settings,banners};
}

// Public promotion data only: never cache sessions or customer profiles.
export const readHomepage=unstable_cache(loadHomepage,["public-homepage-v1"],{revalidate:30,tags:["homepage-promotions"]});
