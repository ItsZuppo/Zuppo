-- Zuppo customer account storage
-- No CREATE TABLE / ALTER TABLE is needed for this implementation.
-- Profile and saved addresses persist in Supabase Auth user_metadata (auth.users).
-- Changes go through server APIs bound to the signed-in customer.
-- Do not enable public access to auth.users or put the service-role key in the browser.
-- Profile photos are in the existing R2 bucket under avatars/<user-id>/.
-- Orders remain in public.orders and public.order_items, scoped by customer_id.

-- Optional: inspect the requested demo account in Supabase SQL Editor (read only).
select id, email,
       raw_user_meta_data ->> 'full_name' as full_name,
       raw_user_meta_data ->> 'phone' as phone,
       raw_user_meta_data ->> 'avatar_url' as avatar_url,
       raw_user_meta_data -> 'saved_addresses' as saved_addresses,
       raw_user_meta_data ->> 'default_address_id' as default_address_id
from auth.users
where email = 'customer@local.zuppo.test';

-- Real users should manage these details through /account.
-- Never change raw_app_meta_data.role to edit a customer's profile.
