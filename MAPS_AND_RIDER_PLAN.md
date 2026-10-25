# Zuppo: rider repair and map-provider choice
Checked: 25 October 2026.

## Recommendation
Use Google Maps Platform for the production map/routing integration, with Mappls as the main India-focused alternative. This is an implementation recommendation, not a measured Ambikapur coverage ranking. Before launch, compare at least 5–10 actual pickup/drop pairs around Gandhi Chowk, Ghadi Chowk, Kedarpur and the outer delivery boundary on a phone.

- Google: Maps JavaScript API + Routes API; Places autocomplete is optional for the MVP because a verified delivery GPS pin and a written address can be saved directly.
- Mappls: maps, search, routing/navigation and India-focused support; obtain a current quote for the relevant web/mobile products and monthly usage.
- Ola: an alternative if cost is the priority, but validate the same local routes rather than assuming a free allowance guarantees route quality.

## Current published pricing
Google India list: Dynamic Maps has 70,000 monthly free billable events, then $2.10 per 1,000 in the first paid tier. Compute Routes Essentials has 70,000 monthly free events, then $1.50 per 1,000 in the first paid tier. India billing/usage eligibility applies; INR conversion/taxes and other SKUs are separate. Traffic, advanced routing or two-wheeler requests may use a different SKU and free cap. These are not one combined allowance or a promise of a zero bill.
Source: https://developers.google.com/maps/billing-and-pricing/pricing-india
India eligibility: https://developers.google.com/maps/billing-and-pricing/india-overview

Ola advertises a 100,000-call monthly free allowance on its current pricing page, with product-specific paid tiers and usage units. Confirm the selected plan/products before estimating a bill.
Source: https://maps.olakrutrim.com/pricing

Mappls capabilities: https://developer.mappls.com/documentation/sdk/rest-apis/Readme/

## What tracking actually needs
The customer marker is the saved delivery pin, not a fabricated landmark. The rider marker is the phone GPS position, shared only on the rider's assigned active order. Supabase relays/persists that location. The map provider draws the map and calculates roads/ETA; changing providers does not fix acceptance bugs, missing permissions or bad stored coordinates.

Phone GPS updates should not each trigger a billable route calculation. Keep marker updates separate from route requests; reroute after meaningful movement/deviation. Show stale/offline locations honestly. Website background tracking is not guaranteed on a locked phone; reliable background tracking requires native app permissions and lifecycle handling.

## Account setup required for Google
A Google Cloud project with billing, Maps JavaScript API and Routes API enabled. Use separate restricted browser and server keys; browser key restricted to the actual web domains, server route key kept server-only. Configure quotas and billing alerts. No key is present yet, and no paid provider has been activated by this repair.

## Repaired now
- Manual Accept reserves an order as rider_assigned; it does not mark food as picked up.
- Separate Confirm pickup action is required before PIN delivery.
- Atomic same-order claim: two riders competing for one order cannot both win.
- Immediate double-click lock; stale/overlapping polling responses do not overwrite acceptance state.
- Pass hides the offer from that rider's current radar; the fake expiry countdown and demo movement control are removed.
- Actual pickup latitude/longitude are read from the linked restaurant, and exact delivery coordinates from the order. Partner Kitchen Profile now has a pickup-GPS editor. No name-based or interpolated route pins are fabricated.
- Route targets pickup before collection and customer drop afterward. Route request failure displays a message and keeps real pins visible, with Retry and external Google navigation.
- Marker movement does not rebuild the whole map or force recentering; stationary GPS gets sync heartbeats.

## Verification and limits
The isolated integration test verifies manual acceptance, concurrent two-rider claims, idempotent accept, pickup-before-delivery, GPS ownership/persistence, exact pickup/drop coordinates, PIN checks and rejected GPS writes after completion. All test accounts/orders/kitchens are removed afterward. Run RUN_RIDER_INTEGRATION=1 node tests/rider-flow-integration.cjs; RIDER_TEST_BASE_URL can target a deployed site.

This test uses known QA coordinates; it does not certify phone sensor accuracy, real road travel, background tracking or any provider's Ambikapur ETA quality. A two-phone field test is still required before claiming a production delivery experience.
