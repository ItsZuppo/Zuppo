# Web security and delivery update - 24 October 2026

## Implemented locally
- Private order reads require login and ownership; partner scope uses restaurant UUID, not a name.
- Only the owning customer can read/regenerate the delivery PIN. Rider/admin order responses omit it.
- Admin KYC reads/writes require admin role. Menu, category, restaurant and upload mutations require the appropriate session.
- Login elevates only from server-managed app_metadata; editable user_metadata is not trusted for approval/role.
- Demo staff login is disabled unless ENABLE_DEMO_LOGIN=true in non-production. Unverified quick-phone login removed.
- Session signing requires AUTH_SECRET (at least 32 characters); server checks expiry and constant-time signature comparison.
- OTP uses crypto randomness, browser-bound HttpOnly challenge, resend cooldown and five-attempt cap.
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
- Add durable idempotency keys and delivery/PIN attempt counters for multi-instance production. OTP proof/rate limits still use a process-local store; use a durable challenge store for serverless deployments.
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
Production build attempts and their outcomes should be reported separately; no deployment was performed.
