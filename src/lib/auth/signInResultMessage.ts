/** Error codes thrown from Credentials `authorize` in `src/lib/auth.ts`. */
export const SIGN_IN_ERROR_CODES = {
  databaseUnavailable: "database_unavailable",
  serviceError: "service_error",
} as const;

type SignInResult = {
  error?: string | null;
  code?: string | null;
};

/**
 * Maps `next-auth/react` `signIn(..., { redirect: false })` fields to UI copy.
 * Auth.js maps many server failures to `error=Configuration`, which is easy to misread as bad credentials.
 */
export function signInResultMessage(result: SignInResult | undefined): string | null {
  if (!result?.error) return null;

  if (result.error === "CredentialsSignin") {
    if (result.code === SIGN_IN_ERROR_CODES.databaseUnavailable) {
      return "Cannot reach the database. Confirm DATABASE_URL and that the database is running, then try again.";
    }
    if (result.code === SIGN_IN_ERROR_CODES.serviceError) {
      return "Sign-in failed due to a server error. Try again in a moment.";
    }
    // Default Auth.js code is `credentials` (wrong password, unknown email, or empty new DB).
    return "Invalid email or password. If you just started using a local database, register once first—accounts from another host are not copied.";
  }

  if (result.error === "Configuration") {
    return "Sign-in failed due to a server error. If you are the developer, check server logs (often database connectivity or AUTH_SECRET).";
  }

  return "Sign-in failed. Please try again.";
}
