import { createWorkersResponseStoreSelfContainedConfig } from "@vinext/cloudflare/cache/config";
import { bindings, defineConfig, defineWorker } from "cf/config";

const responseStore = await createWorkersResponseStoreSelfContainedConfig({
  worker: "umutungoapp1",
  bucket: "umutungoapp1-response-cache",
});

export default defineConfig({
  worker: defineWorker({
    ...responseStore,
    name: "umutungoapp1",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...responseStore.env,
      ASSETS: bindings.assets(),
      IMAGES: bindings.images(),
    },
  }),
});
