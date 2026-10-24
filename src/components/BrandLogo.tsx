import Image from "next/image";

/** Uses the owner's original artwork without cropping or redrawing it. */
export default function BrandLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  return <Image unoptimized loading="eager" src="/zuppo-logo.png" alt="Zuppo Food Delivery" width={size} height={size} sizes={`${size}px`} className={`shrink-0 rounded-xl object-contain ${className}`} />;
}
