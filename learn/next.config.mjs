import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Wrap with Sentry. The wrapper is a no-op at runtime if no DSN is set —
// it only attaches build-time source-map upload (also no-op without
// SENTRY_AUTH_TOKEN). Safe to ship without any Sentry env vars.
export default withSentryConfig(nextConfig, {
  // Suppress build noise when keys are missing
  silent: true,
  // Don't upload source maps unless we explicitly have an auth token
  // (avoids confusing CI errors during the rollout window).
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  // Org/project — needed only for source-map upload. Set in Vercel when
  // you create the Sentry project.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
