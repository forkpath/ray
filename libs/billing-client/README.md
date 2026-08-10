# `@libs/billing-client`

Universal HTTP/query adapter for the Billing domain.

- depends on the public `@libs/api-client` transport factories;
- uses `@libs/payload` schemas before mutations leave the client;
- scopes React Query cache keys by owner kind and owner ID;
- supports personal and organization Billing endpoints without placing owner
  identity in mutation bodies.

The server derives the user from the Better Auth session and the organization
from the authorized path. IDs in client scopes select the URL and isolate the
cache; they are never accepted by the server as authorization proof.
