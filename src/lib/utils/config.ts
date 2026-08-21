export const IS_PRODUCTION = process.env.NODE_ENV === "production";

export function getServerSecret(name: string, developmentFallback: string): string {
  const configuredValue = process.env[name]?.trim();
  if (configuredValue) return configuredValue;

  if (IS_PRODUCTION) {
    throw new Error(`${name} must be configured in the production environment.`);
  }

  return developmentFallback;
}

export const JWT_SECRET = getServerSecret("JWT_SECRET", "local-development-jwt-secret");
export const TOKEN_COOKIE_NAME = "auth_token";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
