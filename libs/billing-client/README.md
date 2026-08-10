# `@libs/billing-client`

Universal HTTP/query adapter for the Billing domain.

- depends on the public `@libs/api-client` transport factories;
- uses `@libs/payload` schemas before mutations leave the client;
- scopes React Query cache keys by owner kind and user ID;
- calls only the existing personal Billing endpoints in this migration wave.

The server still derives authorization from the Better Auth session. The
`userId` in `UserBillingScope` is cache identity, never request authorization.
Organization Billing endpoints and owner persistence remain Wave 4 work.
