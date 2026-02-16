function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get BETTER_AUTH_SECRET() {
    return getEnvVar("BETTER_AUTH_SECRET");
  },
  get BETTER_AUTH_URL() {
    return process.env.BETTER_AUTH_URL || "http://localhost:5173";
  },
  get DATABASE_URL() {
    return getEnvVar("DATABASE_URL");
  },
  get UPLOADTHING_TOKEN() {
    return getEnvVar("UPLOADTHING_TOKEN");
  },
  get RESEND_API_KEY() {
    return getEnvVar("RESEND_API_KEY");
  },
  get GOOGLE_CLIENT_ID() {
    return getEnvVar("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return getEnvVar("GOOGLE_CLIENT_SECRET");
  },
  get GEMINI_API_KEY() {
    return process.env.GEMINI_API_KEY || null;
  },
};
