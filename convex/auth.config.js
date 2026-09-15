export default {
  providers: [
    {
      // TODO: replace with your Clerk JWT template Issuer URL.
      // Clerk Dashboard → JWT Templates → New template → Convex
      // (template name must be "convex") → copy Issuer, paste below,
      // then run: npx convex env set CLERK_JWT_ISSUER_DOMAIN=<issuer>
      // and redeploy. Placeholder keeps local `convex dev` working.
      domain: "https://placeholder.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
