export default {
  providers: [
    {
      // Clerk JWT template "convex" Issuer URL.
      // Rotate via: npx convex env set CLERK_JWT_ISSUER_DOMAIN=<issuer>
      domain: "https://fluent-escargot-3217.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
