// Opt-in test: creates and removes a disposable Supabase customer. No email/order is sent.
if(process.env.RUN_ACCOUNT_INTEGRATION!=='1'){console.log('Set RUN_ACCOUNT_INTEGRATION=1 to run.');process.exit(0);}
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const base=process.env.ACCOUNT_TEST_BASE_URL || 'http://localhost:3000';
(async()=>{let id;try{
 const email=`account-check-${crypto.randomUUID()}@example.invalid`,password=crypto.randomBytes(20).toString('hex');
 const created=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role:'customer',status:'active'},user_metadata:{full_name:'Account Test'}});if(created.error)throw created.error;id=created.data.user.id;
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'customer',username:email,password})});const l=await login.json();assert.equal(l.success,true,JSON.stringify(l));
 const cookie=login.headers.getSetCookie().find(s=>s.startsWith('ambibite_auth_session=')).split(';')[0];
 async function call(method,body,c=cookie){const r=await fetch(base+'/api/account',{method,headers:{'Content-Type':'application/json',cookie:c},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};}
 assert.equal((await call('GET',null,'')).status,401);
 assert.equal((await call('PATCH',{action:'profile',name:'',phone:''})).status,400);
 assert.equal((await call('PATCH',{action:'avatar',avatarUrl:'https://evil.invalid/a.png'})).status,400);
 assert.equal((await call('PATCH',{action:'avatar',avatarUrl:''})).body.success,true);
 assert.equal((await call('PATCH',{action:'profile',name:'Saved Customer',phone:'+91 9999999999',avatarUrl:'https://evil.invalid/a.png'})).status,400);
 assert.equal((await call('PATCH',{action:'profile',name:'Saved Customer',phone:'+91 9999999999',avatarUrl:'',role:'admin'})).body.success,true);
 let r=await call('GET');assert.equal(r.body.profile.name,'Saved Customer');
 const real=await db.auth.admin.getUserById(id);assert.equal(real.data.user.user_metadata.full_name,'Saved Customer');assert.equal(real.data.user.app_metadata.role,'customer');
 assert.equal((await call('PATCH',{action:'add-address',label:'Home',address:'123 Test Street, Ambikapur',lat:24,lng:83})).status,400);
 assert.equal((await call('PATCH',{action:'add-address',label:'Home',address:'123 Test Street, Ambikapur',lat:23.12,lng:83.1985})).body.success,true);
 r=await call('GET');const address=r.body.profile.addresses[0];assert.equal(r.body.profile.defaultAddressId,address.id);
 assert.equal((await call('PATCH',{action:'default-address',id:'someone-elses-address'})).status,404);
 assert.equal((await call('PATCH',{action:'remove-address',id:address.id})).body.success,true);
 r=await call('GET');assert.equal(r.body.profile.addresses.length,0);assert.equal(r.body.profile.defaultAddressId,'');
 const reorder=await fetch(base+'/api/account/reorder',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({orderId:crypto.randomUUID()})});assert.equal(reorder.status,404);
 const me=await fetch(base+'/api/auth/me',{headers:{cookie}});assert.equal((await me.json()).user.name,'Saved Customer');
 const orders=await fetch(base+'/api/orders',{headers:{cookie}});assert.deepEqual((await orders.json()).orders,[]);
 console.log('PASS: private account, profile persistence, role injection rejection, avatar URL guard, address validation/add/default/delete, private reorder, fresh session name, private empty order history.');
}finally{if(id){const d=await db.auth.admin.deleteUser(id);if(d.error)throw d.error;console.log('Temporary test customer removed.');}}})().catch(e=>{console.error(e);process.exitCode=1;});
