import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";

export default defineConfig({
  plugins: [
    vinext({
      images: { optimizer: imagesOptimizer() },
      cache: responseStoreAdapter({ mode: "self-contained" }),
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
