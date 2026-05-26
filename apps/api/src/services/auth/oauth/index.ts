import type { OAuthProvider } from "./types.js";
import { yandexProvider } from "./yandex.js";
import { vkProvider } from "./vk.js";
import { googleProvider } from "./google.js";

export type { OAuthProvider, OAuthUserInfo } from "./types.js";

export const oauthProviders: Record<string, OAuthProvider> = {
  yandex: yandexProvider,
  vk: vkProvider,
  google: googleProvider,
};
