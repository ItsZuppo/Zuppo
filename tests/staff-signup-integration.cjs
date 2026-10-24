// Opt-in integration test. Creates/deletes disposable staff accounts and a kitchen.
// Requires STAFF_ADMIN_EMAIL / STAFF_ADMIN_PASSWORD for the target site's admin.
if(process.env.RUN_STAFF_INTEGRATION!=="1"){console.log("Set RUN_STAFF_INTEGRATION=1 to run.");process.exit(0);}
if(!process.env.STAFF_ADMIN_EMAIL || !process.env.STAFF_ADMIN_PASSWORD)throw Error("Set STAFF_ADMIN_EMAIL and STAFF_ADMIN_PASSWORD.");
require('@next/env').loadEnvConfig(process.cwd());const{createClient}=require('@supabase/supabase-js');const crypto=require('node:crypto');const assert=require('node:assert/strict');const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const base=process.env.STAFF_TEST_BASE_URL || 'http://localhost:3000';
async function post(path,body,cookie=''){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookies:r.headers.getSetCookie()};}
(async()=>{const users=[];const restaurants=[];try{
 const admin=await post('/api/auth/login',{role:'admin',username:process.env.STAFF_ADMIN_EMAIL,password:process.env.STAFF_ADMIN_PASSWORD});assert.equal(admin.body.success,true);const adminCookie=admin.cookies.find(x=>x.startsWith('ambibite_auth_session=')).split(';')[0];
 for(const role of ['partner','rider']){
  const email=`staff-${role}-${crypto.randomUUID()}@example.invalid`,password=crypto.randomBytes(20).toString('hex');const g=await db.auth.admin.generateLink({type:'signup',email,password:crypto.randomBytes(20).toString('hex')});if(g.error)throw g.error;users.push(g.data.user.id);
  const v=await post('/api/auth/verify-otp',{email,otp:g.data.properties.email_otp});assert.equal(v.body.success,true,JSON.stringify(v.body));const proof=v.cookies.find(x=>x.startsWith('zuppo_signup_proof=')).split(';')[0];
  const reg=await post('/api/auth/register',{role,email,password,name:'Disposable Staff QA',phone:'+91 9999999999',kitchenName:'Disposable QA Kitchen '+crypto.randomUUID().slice(0,8),area:'Gandhi Chowk',address:'Test only, no delivery',vehicleNumber:'Test vehicle'},proof);
  assert.equal(reg.body.success,true,JSON.stringify(reg.body));assert.equal(reg.body.status,'pending_verification');const id=role==='partner'?reg.body.restaurantId:g.data.user.id;if(role==='partner')restaurants.push(id);
  const pending=await post('/api/auth/login',{role,username:email,password});assert.equal(pending.status,403,JSON.stringify(pending.body));
  const approve=await post('/api/admin/verifications',{type:role,action:'approve',id},adminCookie);assert.equal(approve.body.success,true,JSON.stringify(approve.body));
  const login=await post('/api/auth/login',{role,username:email,password});assert.equal(login.body.success,true,JSON.stringify(login.body));assert.equal(login.body.user.role,role);
  const reject=await post('/api/admin/verifications',{type:role,action:'reject',id,rejectReason:'Disposable QA test complete'},adminCookie);assert.equal(reject.body.success,true);
  assert.equal((await post('/api/auth/login',{role,username:email,password})).status,403);
  console.log('PASS '+role+': signup verification, pending signup, login blocked before approval, admin approval, approved login, rejection blocks login.');
 }
 const missing=await post('/api/admin/verifications',{type:'rider',action:'approve',id:crypto.randomUUID()},adminCookie);assert.equal(missing.status,404,'Nonexistent rider must not return successful approval: '+JSON.stringify(missing.body));
}finally{for(const id of restaurants){const r=await db.from('restaurants').delete().eq('id',id);if(r.error)console.error('Restaurant cleanup failed',r.error.message);}for(const id of users){const r=await db.auth.admin.deleteUser(id);if(r.error)console.error('User cleanup failed',r.error.message);}console.log('Disposable staff accounts and kitchens removed.');}})().catch(e=>{console.error(e);process.exitCode=1;});
