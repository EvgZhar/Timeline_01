import type { OAuthProvider, OAuthUserInfo } from "./types.js";

const AUTH_URL = "https://oauth.yandex.ru/authorize";
const TOKEN_URL = "https://oauth.yandex.ru/token";
const USER_URL = "https://login.yandex.ru/info";

export const yandexProvider: OAuthProvider = {
  name: "yandex",

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.YANDEX_CLIENT_ID ?? "",
      redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/yandex/callback`,
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async exchangeCode(code: string): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.YANDEX_CLIENT_ID ?? "",
        client_secret: process.env.YANDEX_CLIENT_SECRET ?? "",
        redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/yandex/callback`,
      }),
    });
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) throw new Error("Failed to exchange Yandex code");
    return data.access_token;
  },

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(USER_URL, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    const data = await res.json() as {
      id: string;
      default_email?: string;
      first_name?: string;
      last_name?: string;
    };
    return {
      provider: "yandex",
      providerId: data.id,
      email: data.default_email ?? "",
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
    };
  },
};
