export type HomeSettings = {announcementEnabled:boolean;announcement:string;carouselEnabled:boolean;intervalSeconds:number;restaurantIds:string[]};
export const DEFAULT_HOME_SETTINGS: HomeSettings = {announcementEnabled:true,announcement:"Fresh from Ambikapur kitchens, delivered to your door.",carouselEnabled:true,intervalSeconds:5,restaurantIds:[]};
export type HomeBanner = {id:string;slug:string;name:string;cuisine:string;area:string;image:string};
