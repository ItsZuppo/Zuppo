# Web security and delivery update - 24 October 2026

## Implemented locally
- Private order reads require login and ownership; partner scope uses restaurant UUID, not a name.
- Only the owning customer can read/regenerate the delivery PIN. Rider/admin order responses omit it.
- Admin KYC reads/writes require admin role. Menu, category, restaurant and upload mutations require the appropriate session.
- Login elevates only from server-managed app_metadata; editable user_metadata is not trusted for approval/role.
- Demo staff login is disabled unless ENABLE_DEMO_LOGIN=true in non-production. Unverified quick-phone login removed.
- Session signing requires AUTH_SECRET (at least 32 characters); server checks expiry and constant-time signature comparison.
- Signup/recovery codes are now issued and verified by Supabase Auth and delivered through Brevo. Registration requires a server-validated HttpOnly signup proof; no process-local OTP memory is used by the live routes. Recovery is single-use, updates the password server-side, and invalidates older website sessions.
- Failed account creation no longer fabricates customer identities.
- Checkout verifies live menu IDs/prices, one restaurant, stock, open state, totals, address and 12 km straight-line service radius.
- Checkout currently supports COD only; the unverified UPI-completed shortcut is disabled.
- Order create/update failures return errors; cart stays available. No RAM-only order successes.
- Rider claiming retains conditional DB assignment. Delivery updates compare status/PIN at write time.
- Real rider GPS is persisted in DB, validates coordinates and requires assignment on an active delivery.
- Simulated waypoints do not broadcast to customer orders. Map shows delayed/absent GPS honestly.
- OSM attribution enabled and canonical tile URL used; road-route failure is labeled as a direct-line fallback.
- Public upload endpoint no longer accepts identity documents or hardcoded R2 secrets; image count/type/size checks added.

## Account configuration still required
- Keep the current Supabase project; do NOT rerun an already completed GPS migration.
- Owner confirmed help.zuppo@gmail.com. Live lookup found no registered account. ADMIN_BOOTSTRAP_EMAIL is configured locally; registering that exact email through the customer email-OTP signup provisions a trusted admin role. No invitation or email was sent during setup. Use the admin tab with that email/password after signup.
- Existing partner/rider accounts need server-managed role/status (and restaurantId for partners).
  Admin approval now writes those fields. Old signed sessions will need fresh login.
- AUTH_SECRET and R2 keys must be configured in the environment; rotate previously exposed credentials in provider consoles.
- Identity document uploads need PRIVATE storage and authenticated download/signed-URL access. Public R2 media storage is not an acceptable KYC store. That upload flow is intentionally blocked until configured.
- Staff previously registered before this change may need trusted metadata backfill. Do not self-assign admin privileges from browser forms.

## Known remaining engineering work
- Checkout currently uses compensating deletion if line-item insertion fails. Move order + item writes into a transactional DB function before a public launch. No new DB function/migration was deployed in this change.
- Add durable idempotency keys and delivery/PIN attempt counters for multi-instance production. OTP state is now managed by Supabase Auth. Add durable per-IP/email abuse protection for the custom Brevo dispatch endpoint; its browser cooldown alone is not sufficient abuse prevention.
- Missing schema columns, constraints or RLS in the actual live DB have not been certified by these local tests. API guards do not fix a publicly exposed Data API. Inspect exact live project before changing its RLS.
- Add-ons still need durable option IDs/price snapshots end-to-end. The checkout charges only authoritative base menu prices; no unsupported browser-supplied extras are accepted.
- COD cash handovers/payout accounting need durable ledger transactions and reconciliation.
- Test current-location/address UX and GPS foreground/background behavior on actual HTTPS phones.
- Map route/tiles use third-party public servers; no SLA, traffic ETA or unlimited-volume promise. Use a suitable hosting plan/provider as usage grows.
- Map-based radius is a service area circle, not the legal city boundary or driving distance. Browser coordinates can be spoofed.
- Framework security upgrade and repository-wide lint cleanup remain separate work. Do not mark production-ready from a passing typecheck.

## Verification
Run: node tests/security-regression.cjs
Run: npx tsc --noEmit --incremental false
The regression suite mocks database/providers; no live OTP, order or private data was created by those checks.
Auth integration: with the local server running, set RUN_AUTH_INTEGRATION=1 and run node tests/auth-integration.cjs. This explicitly creates and removes one disposable Supabase account, sends no emails, and tests proof binding, signup/login, role rejection, password recovery, replay rejection and old-session invalidation.

The startup animation and auth changes were pushed to ItsZuppo/Zuppo main for Vercel. Confirm the latest Vercel deployment status separately. Required production values: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, AUTH_SECRET (32+ characters), BREVO_API_KEY and BREVO_SENDER_EMAIL. Local temporary accounts are deliberately disabled in production.

## Customer account page
- /account contains profile editing, R2 profile photos, saved addresses (add/remove/default), current GPS capture, order history, order tracking and reorder-to-cart.
- Customer sign-in/signup redirects to /account; homepage reads the session and displays the customer's name/photo. Saved addresses are selectable at checkout.
- Profile fields and saved addresses persist in auth.users.raw_user_meta_data through server-only authenticated APIs. No new table/schema migration is required. See supabase/customer-account-guide.sql for a read-only inspection query.
- Avatar objects use avatars/<customer-id>/<random-id> in the existing R2 bucket. Customer upload permissions are restricted to that folder with size, MIME and signature checks.
- Reorder only reads the current customer's order, checks the restaurant and current menu availability, and prepares a cart for review at current prices. It does not place an order or charge a payment.
- Run RUN_ACCOUNT_INTEGRATION=1 node tests/account-integration.cjs with the local server running; ACCOUNT_TEST_BASE_URL can target the deployed website. The test creates/removes a disposable customer and sends no orders/emails.

## Homepage presentation controls
- The homepage is now server-rendered with the signed-in customer profile and restaurant carousel data, avoiding the initial Login/name flash. The profile avatar is the last control on the right.
- Admin > Homepage & Banners controls announcement visibility/text, carousel visibility, selected restaurants, slide order and 3–15 second timing. Banner uploads update the selected restaurant's existing banner.
- Global display settings persist in the existing R2 bucket at site/homepage.json. No Supabase schema change or SQL is needed. Public reads include only public banner/settings data; writes require admin.
- Carousel uses actual restaurant banners, omits blocked restaurants, pauses on hover/focus and respects reduced-motion preferences. Settings refresh for open customer pages every minute; a reload gets them immediately.
- Verified authenticated first HTML contains the profile rather than Login, banner HTML is present, customer settings writes return 403, invalid slide timing returns 400, and admin saves persist/read back correctly.

## Responsiveness improvements
- Account APIs reuse the fresh authenticated user record; profile reads no longer repeat the same Supabase Auth lookup. Successful writes return the updated profile so the browser does not need an immediate second GET.
- Order history loads when its tab is opened, with loading feedback. Browser requests in customer/auth/home controls have a 15-second bound (explicit long uploads keep their own deadline); writes are never automatically retried.
- Public homepage promotion data uses a 30-second Next data cache. Homepage settings and restaurant writes invalidate its tag. Customer identity/session/profile data remains uncached and password-reset revocation remains fresh.
- Removed artificial login/signup redirect pauses and kept the submit button pending during navigation. Added route loading feedback and account mutation status text.
- Removed the duplicate external unpkg Leaflet stylesheet from the root; the map already imports its installed local CSS.
- The homepage header now uses signed display-only session hints so it does not block on a remote Auth lookup. It never authorizes reads or writes. The customer account request refreshes display hints; all private APIs still validate the fresh Auth record and password-reset revocation. Account edits renew the signed display cookie with name/photo only, without adding addresses to the cookie.

## GPS demo testing
- Approved native Supabase demo rider and partner accounts are available; the partner is bound to The Royal Kitchen. Credentials are shared privately in chat, not committed here. Local staff demo sessions now defer to native Supabase identities (local-only admin remains separate).
- Rider GPS starts with Enable GPS, displays blocked/error states and offers retry. No permission denial is labeled AUTO/simulated. Customer location is requested from Deliver to > Enable GPS / use my current location, or the saved-address form.
- A rider's captured GPS is synced only to their assigned active delivery. The first assignment syncs even if the rider is stationary; failed requests are retried by subsequent order/location updates and concurrent syncs are avoided.
- Real phone geolocation permission and position acquisition still require testing in the phone's HTTPS browser. Use separate browser profiles/devices for customer, rider and partner: one browser cookie session otherwise replaces the previous role.

## Staff signup/approval verification
- Integration-tested partner and rider email-code verification, pending signup, blocked login before approval, admin approval, approved login and rejection blocking login, with disposable Supabase accounts/kitchens cleaned up afterward.
- Approval now rejects missing/unlinked identities, checks failed activation writes, and paginates Auth users. Partner provisioning failure removes the incomplete kitchen before reporting a retryable error.
- Regression checks cover failed activation, nonexistent rider approval and incomplete-kitchen cleanup. Reserved .invalid/.test test addresses do not receive notification emails.
- Opt-in test: RUN_STAFF_INTEGRATION=1, STAFF_ADMIN_EMAIL and STAFF_ADMIN_PASSWORD, then node tests/staff-signup-integration.cjs. STAFF_TEST_BASE_URL can target the deployed website. Tests do not verify real inbox delivery or upload real KYC documents; private KYC upload storage remains pending.

## Rider acceptance and map repair (25 October 2026)
- Accept is now an explicit action that atomically reserves a ready order as rider_assigned. Confirm pickup is separate; PIN completion requires picked_up. Two riders racing for one order have only one winner.
- Rider UI prevents duplicate action clicks, ignores stale poll responses, does not overlap order polls, respects Offline, and hides passed offers. Removed the resetting fake countdown and simulated movement button.
- Existing assigned deliveries resume with a clear message. They are not auto-created or auto-accepted by polling.
- The map has been rebuilt around real stored restaurant pickup/order delivery coordinates and real rider GPS. No landmark guessing, fabricated midpoints or fake road fallback is displayed. Missing GPS pins are stated honestly. Restaurant pickup GPS is editable from partner Kitchen Profile; an order's customer can correct a missing/wrong delivery pin until delivery closes.
- Map markers update in place; the camera only fits initially or on explicit recenter. Road requests use independent movement buckets, timeout/retry, and clear failure messages. Keyless OSM/OSRM remain the active provider until paid map credentials are configured.
- Rider GPS is synced with 20-second stationary heartbeats on assigned active orders. Cross-order first sync, retry and ownership checks remain enforced.
- RUN_RIDER_INTEGRATION=1 node tests/rider-flow-integration.cjs tests manual acceptance, concurrent claim, pickup gates, GPS ownership, customer pin correction, exact pickup/drop pins and PIN completion; it removes every QA order/kitchen/user afterward. RIDER_TEST_BASE_URL can target live. Device GPS and Ambikapur road/ETA accuracy need a real two-phone field test.
- Provider recommendation, current official price references and the required Google account setup are in MAPS_AND_RIDER_PLAN.md. No paid service, billing account or API key has been created/activated by these changes.
