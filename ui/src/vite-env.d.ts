/// <reference types="vite/client" />

/**
 * The two things the public landing page is configured with at build time.
 *
 * Deliberately the only two: a marketing page that needs a settings screen is
 * an application, and this one is meant to be a file you can serve from
 * anywhere. See `ui/src/features/landing/Demo.tsx`.
 */
interface ImportMetaEnv {
  /** A Loom, Google Drive, YouTube or direct video link for the walkthrough. */
  readonly VITE_DEMO_URL?: string;
  /** Its running time, as a person would say it: "1 min 57". */
  readonly VITE_DEMO_LENGTH?: string;
}
