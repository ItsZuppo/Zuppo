# Separate local portal URLs

- Customer website: http://localhost:3000/
- Customer login/signup: http://localhost:3000/login
- Admin dashboard: http://localhost:3000/admin
- Admin-only login: http://localhost:3000/admin/login
- Restaurant workspace: http://localhost:3000/partner
- Restaurant-only login/signup: http://localhost:3000/partner/login
- Rider workspace: http://localhost:3000/rider
- Rider-only login/signup: http://localhost:3000/rider/login

Dashboards redirect to their own login when unauthenticated or the role is not allowed.
An authenticated admin can access operational workspaces. API authorization remains required.
The customer navigation and order confirmation no longer expose staff dashboards.
No shared role picker is shown on login pages. Admin self-registration is hidden.

These are separate paths on one local website, not deployed domains. The session cookie
is shared on this hostname; use separate browser profiles for simultaneous different-role testing.
Use a real domain and DNS/hosting configuration for future subdomain separation.

UI changes: consistent focus/press states and reduced-motion support; loading skeletons;
workspace identity/sign-out strip; admin mobile section tabs and sticky desktop sidebar;
role-specific login copy; map resize handling and explicit camera/recenter controls.

Verification: TypeScript and 18 mocked security regression checks pass. Customer/login pages
and all three role login URLs returned HTTP 200. Admin/partner sign-in screens were visually
reviewed. Authenticated dashboards and actual phone GPS require real-account/device testing.
Next.js still flags a known installed-version security issue; no framework upgrade/deploy done.
