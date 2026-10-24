/** Bound browser requests so controls recover from a stalled connection. Never retries writes. */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
 if(init.signal)return globalThis.fetch(input,init);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{return await globalThis.fetch(input,{...init,signal:controller.signal});}
 catch(error){if(controller.signal.aborted)throw Error("The request took too long. Refresh to check the latest result before retrying.");throw error;}
 finally{clearTimeout(timer);}
}
