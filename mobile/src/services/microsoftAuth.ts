/**
 * Microsoft (Azure AD) sign-in for the mobile app.
 *
 * Uses Expo's AuthSession with PKCE to perform the OAuth flow against
 * the FoetronHRMS Azure AD app, then exchanges the resulting ID token
 * with our backend for an HRMS access token.
 */
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = 'a96a01b1-7a9a-4326-9954-683e83650070';
const TENANT_ID = '99602a89-c774-49bf-9da7-88879da51dc6';

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
};

// Expo Go uses exp:// scheme, standalone builds use msauth.com.smarthrms.app://
function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'msauth.com.smarthrms.app',
    path: 'auth',
  });
}

export interface MicrosoftLoginResult {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department?: string;
  };
}

/**
 * Open the Microsoft login popup and exchange the ID token with our backend.
 * Returns the HRMS user + access token (already saved to AsyncStorage).
 */
export async function signInWithMicrosoft(): Promise<MicrosoftLoginResult> {
  const redirectUri = getRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      prompt: 'select_account',
    },
  });

  await request.makeAuthUrlAsync(discovery);
  const result = await request.promptAsync(discovery);

  if (result.type !== 'success' || !result.params.code) {
    throw new Error(
      result.type === 'cancel' || result.type === 'dismiss'
        ? 'Sign-in cancelled'
        : `Microsoft sign-in failed: ${result.type}`
    );
  }

  // Exchange code for tokens (PKCE — no client secret)
  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code: result.params.code,
      redirectUri,
      extraParams: {
        code_verifier: request.codeVerifier || '',
      },
    },
    discovery
  );

  const idToken = tokenResult.idToken;
  if (!idToken) throw new Error('Microsoft did not return an ID token');

  // Send ID token to our backend, get HRMS access token back
  const data = await api.post<MicrosoftLoginResult>('/auth/microsoft', { idToken });
  await AsyncStorage.setItem('accessToken', data.accessToken);
  return data;
}
