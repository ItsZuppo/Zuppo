export const DELIVERY_CENTER = { lat: 23.1200, lng: 83.1985 };
export const DELIVERY_RADIUS_KM = 12;
export const DELIVERY_FEE = 20;
export const PLATFORM_FEE = 5;
export function validCoords(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
export function distanceKm(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function isServiceable(lat: unknown, lng: unknown): boolean {
  return validCoords(lat, lng) && distanceKm(DELIVERY_CENTER, {lat: lat as number, lng: lng as number}) <= DELIVERY_RADIUS_KM;
}
