import { getSessionUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Safe credentials with guaranteed fallbacks so Vercel never crashes with undefined endpoint
const accountId =
  process.env.R2_ACCOUNT_ID ||
  process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
  "";

const accessKeyId =
  process.env.R2_ACCESS_KEY_ID ||
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
  "";

const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY ||
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
  "";

const bucketName =
  process.env.R2_BUCKET_NAME ||
  process.env.CLOUDFLARE_R2_BUCKET_NAME ||
  "ambibite";

const publicUrl =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN ||
  "https://pub-6173aeb8009d4efd9966052cb0ea9b71.r2.dev";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !["admin", "partner"].includes(user.role)) return NextResponse.json({ success: false, error: "Please log in before uploading." }, { status: user ? 403 : 401 });
    if (!accountId || !accessKeyId || !secretAccessKey) return NextResponse.json({ success: false, error: "Image storage is not configured." }, { status: 503 });
    const formData = await req.formData();
    const folder = (formData.get("folder") as string) || "food";
    
    // Support both single file and multiple files
    const multiFiles = formData.getAll("files") as File[];
    const singleFiles = formData.getAll("file") as File[];
    const allFiles = (multiFiles.length > 0 ? multiFiles : singleFiles).filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (allFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided for upload" },
        { status: 400 }
      );
    }

    if (!["food", "restaurants"].includes(folder)) return NextResponse.json({ success: false, error: "Only public food/restaurant images are supported here. Identity documents require private storage." }, { status: 400 });
    if (allFiles.length > 6 || allFiles.some(f => f.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(f.type))) return NextResponse.json({ success: false, error: "Upload up to 6 JPG, PNG or WebP images, max 5 MB each." }, { status: 400 });
    const r2Client = getR2Client();
    const uploadedUrls: string[] = [];

    for (const file of allFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extension = file.name.split(".").pop() || "jpg";
      const cleanFileName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 25);
      const uniqueKey = `${folder}/${Date.now()}_${Math.floor(Math.random() * 1000)}_${cleanFileName}.${extension}`;

      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: uniqueKey,
          Body: buffer,
          ContentType: file.type || "image/jpeg",
        })
      );

      const fileUrl = `${publicUrl.replace(/\/$/, "")}/${uniqueKey}`;
      uploadedUrls.push(fileUrl);
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedUrls.length} image(s) uploaded to Cloudflare R2 successfully!`,
      url: uploadedUrls[0],
      urls: uploadedUrls,
    });
  } catch (error: any) {
    console.error("R2 Upload Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload image to Cloudflare R2",
      },
      { status: 500 }
    );
  }
}
