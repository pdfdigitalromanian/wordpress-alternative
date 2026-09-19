import { vercelPreset } from "@vercel/react-router/vite";
import type { Config } from "@react-router/dev/config";

export default {
  // Server-side render every route by default; the public CMS site and
  // storefront must return meaningful HTML, not an empty SPA shell.
  ssr: true,
  presets: [vercelPreset()],
} satisfies Config;
