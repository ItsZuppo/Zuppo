"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, MapPin } from "lucide-react";
import { DEFAULT_HOME_SETTINGS, HomeBanner, HomeSettings } from "@/lib/homeSettings";
export type HomeData={settings:HomeSettings;banners:HomeBanner[];loaded:boolean};
export function useHomeSettings(initial?: {settings:HomeSettings;banners:HomeBanner[]} | null){
 const [data,setData]=useState<HomeData>(initial ? {...initial,loaded:true} : {settings:DEFAULT_HOME_SETTINGS,banners:[],loaded:false});
 useEffect(()=>{const controller=new AbortController();const load=()=>fetch("/api/homepage",{cache:"no-store",signal:controller.signal}).then(r=>r.json()).then(d=>{if(d.success)setData({...d,loaded:true});else setData(d=>({...d,loaded:true}));}).catch(()=>{if(!controller.signal.aborted)setData(d=>({...d,loaded:true}));});if(!initial)load();const refresh=setInterval(()=>{if(!document.hidden)load();},60000);return()=>{controller.abort();clearInterval(refresh);};},[]);
 return data;
}
export function HomeAnnouncement({settings:data}:{settings:HomeData}){
 if(!data.settings.announcementEnabled || !data.settings.announcement)return null;
 return <div className="home-announcement"><span className="home-announcement__dot"/><p>{data.settings.announcement}</p><span className="hidden text-stone-400 sm:inline">Made for Ambikapur</span></div>;
}
export function RestaurantHero({settings:data}:{settings:HomeData}){
 const [active,setActive]=useState(0);const [paused,setPaused]=useState(false);const [hover,setHover]=useState(false);const banners=data.banners;
 useEffect(()=>{if(paused || hover || banners.length<2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const timer=setInterval(()=>setActive(a=>(a+1)%banners.length),data.settings.intervalSeconds*1000);return()=>clearInterval(timer);},[paused,hover,banners.length,data.settings.intervalSeconds]);
 if(!data.settings.carouselEnabled)return null;
 if(!data.loaded)return <div className="restaurant-hero animate-pulse !bg-orange-50" aria-label="Loading restaurant highlights"/>;
 if(!banners.length)return null;
 const current=active%banners.length;
 return <section aria-label="Featured Ambikapur restaurants" aria-roledescription="carousel" className="restaurant-hero" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setHover(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setHover(false);}}>
  {banners.map((b,i)=><img key={b.id} src={b.image} alt="" fetchPriority={i===0?"high":"auto"} className={`restaurant-hero__image ${i===current?"is-active":""}`}/>)}
  <div className="restaurant-hero__shade"/><div className="restaurant-hero__content"><span className="restaurant-hero__eyebrow">LOCAL KITCHENS. BIG FLAVOURS.</span><h1 key={banners[current].id}>{banners[current].name}</h1><p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">{banners[current].cuisine}</p><span className="mt-3 flex items-center gap-1.5 text-xs text-white/75"><MapPin size={13}/>{banners[current].area}, Ambikapur</span><Link href={`/restaurant/${banners[current].slug || banners[current].id}`} className="mt-6 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold text-stone-900 shadow-sm">Explore the menu<ArrowUpRight size={17}/></Link></div>
  {banners.length>1&&<div className="restaurant-hero__controls"><div className="flex gap-2">{banners.map((b,i)=><button key={b.id} onClick={()=>setActive(i)} aria-label={`Show ${b.name}`} aria-current={i===current?"true":undefined} className={`restaurant-hero__dot ${i===current?"is-active":""}`}/>)}</div><div className="flex gap-2"><button aria-label={paused?"Play carousel":"Pause carousel"} onClick={()=>setPaused(p=>!p)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button><button aria-label="Previous restaurant" onClick={()=>setActive((current-1+banners.length)%banners.length)}><ChevronLeft size={17}/></button><button aria-label="Next restaurant" onClick={()=>setActive((current+1)%banners.length)}><ChevronRight size={17}/></button></div></div>}
 </section>;
}
