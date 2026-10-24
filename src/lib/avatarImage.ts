/** Prepare a sharp, small avatar without uploading the original camera photo. */
export async function prepareAvatar(file: File): Promise<{file:File;originalKb:number;uploadKb:number}> {
 if (!file.size || file.size > 25 * 1024 * 1024) throw Error("Choose a photo smaller than 25 MB.");
 if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw Error("Choose a JPG, PNG or WebP photo. Export HEIC photos as JPG first.");
 const source = URL.createObjectURL(file);
 try {
  const image = new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error("This photo could not be opened. Try exporting it as JPG or PNG."));image.src=source;});
  if (!image.naturalWidth || !image.naturalHeight) throw Error("This image is empty.");
  // Keep already-small files unchanged, including their original quality.
  if (file.size <= 200 * 1024 && Math.max(image.naturalWidth,image.naturalHeight)<=1024) return {file,originalKb:Math.ceil(file.size/1024),uploadKb:Math.ceil(file.size/1024)};
  let result: Blob | null = null;
  for (const limit of [1024,768,512]) {
   const scale=Math.min(1,limit/image.naturalWidth,limit/image.naturalHeight);
   const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const ctx=canvas.getContext("2d");if(!ctx)throw Error("Photo processing is unavailable in this browser.");
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(image,0,0,canvas.width,canvas.height);
   result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",0.94));
   if(result && result.size<=1024*1024)break;
  }
  if(!result || result.size>1024*1024)throw Error("Could not prepare this photo. Please choose another image.");
  // Do not replace the original if re-encoding made the file larger.
  if(file.size<=result.size && file.size<=1024*1024)return {file,originalKb:Math.ceil(file.size/1024),uploadKb:Math.ceil(file.size/1024)};
  const extension=result.type==="image/webp"?"webp":result.type==="image/jpeg"?"jpg":"png";
  const output=new File([result],`profile.${extension}`,{type:result.type,lastModified:Date.now()});
  return {file:output,originalKb:Math.ceil(file.size/1024),uploadKb:Math.ceil(output.size/1024)};
 } finally { URL.revokeObjectURL(source); }
}
