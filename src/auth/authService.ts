// Cognito auth flows (Amplify Gen 2 Auth) behind one small surface. In
// design-fidelity mode every call succeeds immediately so the prototype
// flows keep working without AWS.

import {
  confirmResetPassword,
  confirmSignUp,
  fetchUserAttributes,
  getCurrentUser,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { isConnected } from '../lib/amplify';

export interface SessionInfo {
  authed: boolean;
  name?: string;
  email?: string;
}

export async function checkSession(): Promise<SessionInfo> {
  if (!isConnected) return { authed: true };
  try {
    const user = await getCurrentUser();
    let name: string | undefined;
    let email: string | undefined = user.signInDetails?.loginId;
    try {
      const attrs = await fetchUserAttributes();
      name = attrs.preferred_username ?? attrs.name;
      email = attrs.email ?? email;
    } catch {
      // attributes are a nicety; the session itself is what matters
    }
    return { authed: true, name, email };
  } catch {
    return { authed: false };
  }
}

export async function doSignIn(email: string, password: string): Promise<void> {
  if (!isConnected) return;
  const { isSignedIn, nextStep } = await signIn({ username: email, password });
  if (!isSignedIn) {
    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      await resendSignUpCode({ username: email });
      throw new AuthStep('confirm');
    }
    throw new Error(`Additional sign-in step required: ${nextStep.signInStep}`);
  }
}

export async function doSignUp(name: string, email: string, password: string): Promise<void> {
  if (!isConnected) return;
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email, preferred_username: name || undefined } },
  });
}

export async function doConfirm(email: string, code: string): Promise<void> {
  if (!isConnected) return;
  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function doResendCode(email: string): Promise<void> {
  if (!isConnected) return;
  await resendSignUpCode({ username: email });
}

export async function doStartReset(email: string): Promise<void> {
  if (!isConnected) return;
  await resetPassword({ username: email });
}

export async function doConfirmReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  if (!isConnected) return;
  await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
}

export async function doSignOut(): Promise<void> {
  if (!isConnected) return;
  await signOut();
}

/** Thrown when a flow needs to hop to another auth screen (e.g. an
 *  unconfirmed account signing in gets sent to the code screen). */
export class AuthStep extends Error {
  constructor(public step: 'confirm') {
    super(`auth step: ${step}`);
  }
}
