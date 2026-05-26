import type { OAuthProvider, OAuthUserInfo } from "./types.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USER_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const googleProvider: OAuthProvider = {
  name: "google",

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/google/callback`,
      state,
      scope: "openid email profile",
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
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: `${process.env.AUTH_CALLBACK_URL ?? "http://localhost:3001"}/api/auth/oauth/google/callback`,
      }),
    });
    const data = await res.json() as { access_token?: string };
    if (!data.access_token) throw new Error("Failed to exchange Google code");
    return data.access_token;
  },

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch(USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as {
      id: string;
      email?: string;
      given_name?: string;
      family_name?: string;
    };
    return {
      provider: "google",
      providerId: data.id,
      email: data.email ?? "",
      firstName: data.given_name ?? "",
      lastName: data.family_name ?? "",
    };
  },
};
