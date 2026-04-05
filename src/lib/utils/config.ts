export const JWT_SECRET = process.env.JWT_SECRET || "E3purchase2026";
export const TOKEN_COOKIE_NAME = "auth_token";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
