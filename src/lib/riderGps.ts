export function shouldSyncRiderLocation(previous: {lat:number;lng:number} | null, next: {lat:number;lng:number}, previousOrderId: string | null, orderId: string, lastSentAt?: number, now = Date.now()): boolean {
 return (lastSentAt !== undefined && now-lastSentAt>=20000) || !previous || previousOrderId !== orderId || Math.abs(previous.lat-next.lat)>=0.000015 || Math.abs(previous.lng-next.lng)>=0.000015;
}
