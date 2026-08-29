import { Router } from "express";
import { MODELS, SettingsPatchSchema, type SettingsStatus } from "@studio/shared";
import { getSettings, updateSettings } from "../services/settings.ts";
import { apiKeySource, clearStoredApiKey, maskApiKey, storeApiKey } from "../services/secrets.ts";
import { verifyApiKey } from "../services/anthropic.ts";
import { badRequest } from "../errors.ts";

const router = Router();

function status(): SettingsStatus {
  const source = apiKeySource();
  return {
    settings: getSettings(),
    apiKey: { configured: source !== "none", masked: maskApiKey(), source },
  };
}

router.get("/", (_request, response) => {
  response.json(status());
});

router.get("/models", (_request, response) => {
  response.json(MODELS);
});

router.put("/", async (request, response) => {
  await updateSettings(SettingsPatchSchema.parse(request.body));
  response.json(status());
});

router.put("/api-key", async (request, response) => {
  const key = (request.body as { apiKey?: string })?.apiKey?.trim();
  if (!key) throw badRequest("`apiKey` is required.");
  if (!key.startsWith("sk-ant-")) {
    throw badRequest('Anthropic API keys start with "sk-ant-".');
  }
  await storeApiKey(key);
  response.json(status());
});

router.delete("/api-key", async (_request, response) => {
  await clearStoredApiKey();
  response.json(status());
});

router.post("/api-key/test", async (_request, response) => {
  response.json(await verifyApiKey());
});

export default router;
