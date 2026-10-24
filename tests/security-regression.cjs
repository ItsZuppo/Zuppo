const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const crypto = require('node:crypto');
let user = null;
let rows = [];
let failure = null;
let calls = [];
const db = {
  from(table) {
    const call = {table, action:'select', filters:[]}; calls.push(call);
    const q = {};
    for (const method of ['select','order','eq','is','in','ilike','insert','update','delete']) q[method] = (...args) => {
      if (['insert','update','delete'].includes(method)) {call.action=method; call.payload=args[0];}
      if (['eq','is','in'].includes(method)) call.filters.push([method,...args]);
      return q;
    };
    q.maybeSingle = q.single = async () => ({data:rows[0] || null,error:failure});
    q.then = (resolve,reject) => Promise.resolve({data:rows,error:failure}).then(resolve,reject);
    return q;
  }
};
const response = {json: (body, init={}) => ({status:init.status || 200,body})};
function load(file, overrides={}) {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports = {};
  const req = name => {
    if (overrides[name]) return overrides[name];
    if (name==='next/server') return {NextResponse:response};
    if (name==='@supabase/supabase-js') return {createClient:()=>db};
    if (name==='@/lib/auth') return {getSessionUser:async()=>user};
    if (name==='@/lib/delivery') return delivery;
    if (name==='@/lib/email') return {sendEmailViaBrevo:async()=>({success:true})};
    if (name==='crypto') return crypto;
    throw Error('Unexpected import '+name);
  };
  vm.runInNewContext(code,{exports,require:req,process,Buffer,console,URL,Date,Map,Number,Math,global:{}},{filename:file});
  return exports;
}
const delivery = load('src/lib/delivery.ts');
const orders = load('src/app/api/orders/route.ts');
const pins = load('src/app/api/orders/regenerate-pin/route.ts');
const admin = load('src/app/api/admin/verifications/route.ts');
const request = (body, url='http://localhost/api/orders') => ({url,json:async()=>body});
const uid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const order={id:uid,customer_id:'owner',restaurant_id:'kitchen',restaurant_name:'Kitchen',delivery_pin:'1234',status:'picked_up',rider_id:'driver',order_items:[]};
let count=0;
async function check(label, fn) {await fn(); count++; console.log('PASS '+label);}
(async()=>{
 await check('city centre allowed',()=>assert.equal(delivery.isServiceable(23.12,83.1985),true));
 await check('outside 12 km rejected',()=>assert.equal(delivery.isServiceable(24,83.1985),false));
 await check('invalid/missing coordinates rejected',()=>{for(const pair of [[NaN,83],['23',83],[91,83],[23,undefined]])assert.equal(delivery.isServiceable(...pair),false);});
 await check('unauthenticated private order list denied',async()=>assert.equal((await orders.GET(request({}))).status,401));
 await check('unauthenticated order creation denied',async()=>assert.equal((await orders.POST(request({}))).status,401));
 await check('public PIN regeneration denied',async()=>assert.equal((await pins.POST(request({orderId:uid}))).status,401));
 await check('admin KYC GET/POST deny anonymous',async()=>{assert.equal((await admin.GET()).status,401);assert.equal((await admin.POST(request({}))).status,401);});
 user={id:'intruder',role:'customer'};rows=[order];
 await check('known UUID does not reveal another customer PIN',async()=>assert.equal((await orders.GET(request({},'http://localhost/api/orders?id='+uid))).body.orders.length,0));
 await check('another customer cannot regenerate PIN',async()=>assert.equal((await pins.POST(request({orderId:uid}))).status,404));
 await check('another customer cannot change status',async()=>assert.equal((await orders.PATCH(request({orderId:uid,status:'delivered',submittedPin:'1234'}))).status,403));
 user={id:'owner',role:'customer'};
 await check('owner receives own delivery PIN',async()=>assert.equal((await orders.GET(request({},'http://localhost/api/orders?id='+uid))).body.orders[0].deliveryPin,'1234'));
 failure={message:'DB offline'};
 await check('read failure is not a memory success',async()=>assert.equal((await orders.GET(request({}))).status,503));failure=null;
 user={id:'driver',role:'rider'};
 await check('rider never receives customer PIN',async()=>assert.equal((await orders.GET(request({},'http://localhost/api/orders?id='+uid))).body.orders[0].deliveryPin,undefined));
 await check('invalid GPS denied',async()=>assert.equal((await orders.PATCH(request({orderId:uid,riderLat:Infinity,riderLng:83}))).status,400));
 await check('wrong delivery PIN denied',async()=>assert.equal((await orders.PATCH(request({orderId:uid,status:'delivered',submittedPin:'9999'}))).status,400));
 failure={message:'write failed'};
 await check('failed delivery update is not acknowledged',async()=>assert.equal((await orders.PATCH(request({orderId:uid,status:'delivered',submittedPin:'1234'}))).status,503));failure=null;
 rows=[{...order,status:'ready_for_pickup',rider_id:null}]; calls=[];
 await check('rider claim uses conditional DB ownership + state',async()=>{await orders.PATCH(request({orderId:uid,status:'picked_up'})); const c=calls.find(c=>c.action==='update');assert.ok(c.filters.some(f=>f[0]==='is'&&f[1]==='rider_id'&&f[2]===null)); assert.ok(c.filters.some(f=>f[1]==='status'&&f[2]==='ready_for_pickup'));});
 console.log(`${count} security/delivery regression checks passed. Database/provider calls mocked; no live messages or orders created.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
