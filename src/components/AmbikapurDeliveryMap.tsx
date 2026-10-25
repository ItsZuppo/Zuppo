"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, Navigation, RefreshCw } from "lucide-react";
import { validCoords } from "@/lib/delivery";
interface DeliveryMapProps {restaurantName?:string;customerArea?:string;orderNumber?:string;mode?:"customer"|"rider";height?:string;riderLat?:number;riderLng?:number;riderLocationUpdatedAt?:string;customerLat?:number;customerLng?:number;restaurantLat?:number;restaurantLng?:number;destination?:"pickup"|"drop";}
type Point=[number,number];
export default function AmbikapurDeliveryMap({restaurantName="Restaurant",customerArea="Delivery address",orderNumber,mode="customer",height="280px",riderLat,riderLng,riderLocationUpdatedAt,customerLat,customerLng,restaurantLat,restaurantLng,destination="drop"}:DeliveryMapProps){
 const container=useRef<HTMLDivElement>(null);const map=useRef<LeafletMap|null>(null);const markers=useRef<Record<string,Marker>>({});const line=useRef<Polyline|null>(null);const fitted=useRef(false);const routeCache=useRef<{key:string;time:number}|null>(null);
 const [loaded,setLoaded]=useState(false);const [mapError,setMapError]=useState("");const [routeLabel,setRouteLabel]=useState("Waiting for confirmed location pins");const [fullscreen,setFullscreen]=useState(false);const [retry,setRetry]=useState(0);const [now,setNow]=useState(Date.now());
 const pickup:Point|null=validCoords(restaurantLat,restaurantLng)?[restaurantLat!,restaurantLng!]:null;
 const drop:Point|null=validCoords(customerLat,customerLng)?[customerLat!,customerLng!]:null;
 const rider:Point|null=validCoords(riderLat,riderLng)?[riderLat!,riderLng!]:null;
 const target=destination==="pickup"?pickup:drop;
 const origin=rider || (destination==="drop"?pickup:null);
 const routeFromKey=origin?.map(n=>String(Math.round(n*2500)/2500)).join(",") || "";
 const routeToKey=target?.join(",") || "";
 const gpsAge=riderLocationUpdatedAt?now-Date.parse(riderLocationUpdatedAt):Infinity;
 const gpsLabel=rider?(Number.isFinite(gpsAge)&&gpsAge>=-5000&&gpsAge<60000?"Recent rider GPS":"Last known rider GPS — updates delayed"):"Waiting for rider GPS";
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  let cancelled=false;let observer:ResizeObserver|undefined;let instance:LeafletMap|undefined;
  (async()=>{try{const L=await import("leaflet");if(cancelled||!container.current)return;
   instance=L.map(container.current,{center:[23.12,83.1985],zoom:13,scrollWheelZoom:false});map.current=instance;
   L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on("tileerror",()=>{if(!cancelled)setMapError("Map tiles are not loading. Check your connection or use external navigation.");}).addTo(instance);
   line.current=L.polyline([],{color:"#ea580c",weight:5,opacity:.85}).addTo(instance);
   observer=new ResizeObserver(()=>instance?.invalidateSize({pan:false}));observer.observe(container.current);setLoaded(true);
  }catch{if(!cancelled)setMapError("Map could not load. Refresh or use external navigation.");}})();
  return()=>{cancelled=true;observer?.disconnect();instance?.remove();map.current=null;markers.current={};line.current=null;};
 },[]);
 useEffect(()=>{if(!loaded||!map.current)return;let cancelled=false;
  (async()=>{const L=await import("leaflet");if(cancelled||!map.current)return;
   const add=(id:string,point:Point|null,emoji:string,label:string,color:string)=>{if(!point){markers.current[id]?.remove();delete markers.current[id];return;}if(!map.current)return;const popup=document.createElement("span");popup.textContent=label;if(markers.current[id]){markers.current[id].setLatLng(point).setPopupContent(popup);return;}const marker=L.marker(point,{icon:L.divIcon({className:"",html:`<div style="width:34px;height:34px;border:3px solid white;border-radius:50%;background:${color};display:grid;place-items:center;box-shadow:0 2px 9px #0004;font-size:18px">${emoji}</div>`,iconSize:[34,34],iconAnchor:[17,17]})}).bindPopup(popup).addTo(map.current);markers.current[id]=marker;};
   add("pickup",pickup,"🏪",restaurantName,"#ea580c");add("drop",drop,"🏠",customerArea,"#16a34a");add("rider",rider,"🛵","Rider GPS","#1c1917");
   const points=[pickup,drop,rider].filter((p):p is Point=>!!p);if(!fitted.current&&points.length){map.current.fitBounds(L.latLngBounds(points).pad(.2),{maxZoom:16,animate:false});fitted.current=true;}
  })();return()=>{cancelled=true;};
 },[loaded,restaurantLat,restaurantLng,customerLat,customerLng,riderLat,riderLng,restaurantName,customerArea]);
 useEffect(()=>{
  if(!loaded)return;
  if(!origin||!target){line.current?.setLatLngs([]);setRouteLabel(destination==="pickup"?"Pickup GPS pin is missing — ask the restaurant to set it":"Customer GPS pin is missing — confirm the delivery address");return;}
  const key=[...origin,...target].map(n=>n.toFixed(4)).join(",");
  if(routeCache.current?.key===key&&Date.now()-routeCache.current.time<30000)return;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);let cancelled=false;
  const from=[...origin] as Point,to=[...target] as Point;
  setRouteLabel("Finding road route…");line.current?.setLatLngs([]);
  (async()=>{try{
   const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,{signal:controller.signal});if(!r.ok)throw Error("Route unavailable");const d=await r.json();const route=d.routes?.[0];if(!route?.geometry?.coordinates?.length)throw Error("No road route");if(cancelled)return;
   line.current?.setLatLngs(route.geometry.coordinates.map((p:number[])=>[p[1],p[0]]));setRouteLabel(`Road route · ${(route.distance/1000).toFixed(1)} km · ~${Math.max(1,Math.round(route.duration/60))} min estimate`);routeCache.current={key,time:Date.now()};
  }catch{if(!cancelled){routeCache.current=null;line.current?.setLatLngs([]);setRouteLabel("Road route unavailable. Pins remain visible; try again or open navigation.");}}
  finally{clearTimeout(timer);}})();return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
 },[loaded,routeFromKey,routeToKey,destination,retry]);
 useEffect(()=>{map.current?.invalidateSize({pan:false});},[fullscreen]);
 function recenter(){const points=[pickup,drop,rider].filter((p):p is Point=>!!p);if(points.length)map.current?.fitBounds(points,{padding:[35,35],maxZoom:16});}
 return <section className={fullscreen?"fixed inset-0 z-[9999] bg-stone-100":"relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"} style={{height:fullscreen?"100dvh":height,minHeight:height}} aria-label={`Delivery map ${orderNumber||""}`}>
  <div ref={container} className="h-full w-full"/>
  <div className="absolute left-3 right-16 top-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[10px] font-bold text-stone-700 shadow-sm">{gpsLabel}<div className="mt-1 font-medium">{mapError||routeLabel}</div></div>
  <div className="absolute right-3 top-3 z-[500] flex flex-col gap-2"><button onClick={()=>setFullscreen(v=>!v)} aria-label={fullscreen?"Close full screen map":"Open full screen map"} className="rounded-lg bg-white p-2 shadow">{fullscreen?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button onClick={recenter} aria-label="Recenter map" className="rounded-lg bg-white p-2 shadow"><Navigation size={16}/></button><button onClick={()=>{routeCache.current=null;setRetry(v=>v+1);}} aria-label="Retry road route" className="rounded-lg bg-white p-2 shadow"><RefreshCw size={16}/></button></div>
  {!loaded&&!mapError&&<p role="status" className="absolute bottom-4 left-4 z-[500] rounded-lg bg-white p-2 text-xs">Loading map…</p>}
  {mode==="rider"&&target&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}&travelmode=driving&dir_action=navigate`} target="_blank" rel="noreferrer" className="absolute bottom-6 left-3 z-[500] rounded-full bg-white px-3 py-2 text-xs font-bold shadow">Open navigation ↗</a>}
 </section>;
}
