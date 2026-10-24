// Opt-in: creates and removes one disposable Supabase auth account. Sends no email.
// Run against the local dev server: RUN_AUTH_INTEGRATION=1 node tests/auth-integration.cjs
if (process.env.RUN_AUTH_INTEGRATION !== "1") { console.log("Skipped: set RUN_AUTH_INTEGRATION=1 to test local endpoints against Supabase."); process.exit(0); }
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const crypto=require('node:crypto');const assert=require('node:assert/strict');
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function post(path,body,cookie=''){const r=await fetch('http://localhost:3000/api/auth/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookies:r.headers.getSetCookie()};}
(async()=>{let id;const email=`zuppo-http-check-${crypto.randomUUID()}@example.invalid`;const password=' Test password 123! ';
try{
 const g=await c.auth.admin.generateLink({type:'signup',email,password:crypto.randomBytes(32).toString('hex')});if(g.error)throw g.error;id=g.data.user.id;
 assert.equal((await post('register',{email,password,name:'Test',role:'customer'})).status,400);
 const v=await post('verify-otp',{email,otp:g.data.properties.email_otp});assert.equal(v.body.success,true,JSON.stringify(v.body));const cookie=v.cookies.find(x=>x.startsWith('zuppo_signup_proof=')).split(';')[0];
 const mismatch=await post('register',{email:'different@example.invalid',password,name:'Test',role:'customer'},cookie);assert.equal(mismatch.status,400);
 const reg=await post('register',{email,password,name:'Temporary auth test',role:'customer'},cookie);assert.equal(reg.body.success,true,JSON.stringify(reg.body));const oldSession=reg.cookies.find(x=>x.startsWith('ambibite_auth_session=')).split(';')[0];
 assert.equal((await post('login',{role:'customer',username:email,password})).body.success,true);
 assert.equal((await post('login',{role:'admin',username:email,password})).status,401);
 assert.ok([400,409].includes((await post('register',{email,password,name:'Test',role:'rider'},cookie)).status));
 const r=await c.auth.admin.generateLink({type:'recovery',email});if(r.error)throw r.error;
 const newPassword='New test password!';const reset=await post('reset-password',{email,otp:r.data.properties.email_otp,password:newPassword});assert.equal(reset.body.success,true,JSON.stringify(reset.body));const me=await fetch('http://localhost:3000/api/auth/me',{headers:{cookie:oldSession}});assert.equal((await me.json()).authenticated,false);
 assert.equal((await post('reset-password',{email,otp:r.data.properties.email_otp,password:newPassword})).status,400);
 assert.equal((await post('login',{role:'customer',username:email,password})).status,401);
 assert.equal((await post('login',{role:'customer',username:email,password:newPassword})).body.success,true);
 console.log('PASS: HTTP registration requires proof, rejects wrong email and role changes; login preserves password spaces; recovery is single use; old password rejected and new password works.');
}finally{if(id){const d=await c.auth.admin.deleteUser(id);if(d.error)throw d.error;console.log('Temporary test account removed.');}}})().catch(e=>{console.error(e);process.exitCode=1;});

