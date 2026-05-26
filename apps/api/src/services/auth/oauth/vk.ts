import type { OAuthProvider, OAuthUserInfo } from "./types.js";

const AUTH_URL = "https://id.vk.com/authorize";
const TOKEN_URL = "https://id.vk.com/oauth2/auth";
const USER_URL = "https://api.vk.com/method/users.get";

export const vkProvider: OAuthProvider = {
  name: "vk",

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.VK_CLIENT_ID ?? "",
      redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/vk/callback`,
      state,
      scope: "email",
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
        client_id: process.env.VK_CLIENT_ID ?? "",
        client_secret: process.env.VK_CLIENT_SECRET ?? "",
        redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/vk/callback`,
      }),
    });
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) throw new Error("Failed to exchange VK code");
    return data.access_token;
  },

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(`${USER_URL}?v=5.131&fields=email,first_name,last_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as {
      response?: Array<{
        id: number;
        email?: string;
        first_name?: string;
        last_name?: string;
      }>;
    };
    const user = data.response?.[0];
    if (!user) throw new Error("Failed to get VK user info");
    return {
      provider: "vk",
      providerId: String(user.id),
      email: user.email ?? "",
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
    };
  },
};
