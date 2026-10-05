# Screens

Expo web at 390×844 (and one 1280×800 desktop view), captured for the first Admin App pull request.

- **Against the shared dev API:** sign-in, invite (refused and redeemed), scan, My handovers (empty), Hub duty, Admin handovers and receipt scans (empty on dev).
- **Claim results** (`code`, `mismatch`, `escalate`, `escalated`, `done`, `locked`): the dev API has the handover OTP switched off, so no real pick-up QR exists there. A local test proxy answered `POST /staff/hub/claims` and the escalation for demo QR tokens with the API's documented responses (`docs/HUB_HANDOVER_API.md` in gridgo-api).
- **`*-fixture-*`:** populated Admin lists from the same proxy's fixture data. The names are test names.
