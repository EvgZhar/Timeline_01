export interface OAuthUserInfo {
  provider: string;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface OAuthProvider {
  name: string;
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<string>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}
