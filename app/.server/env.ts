function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get AUTH_USERNAME() {
    return getEnvVar("AUTH_USERNAME");
  },
  get AUTH_PASSWORD() {
    return getEnvVar("AUTH_PASSWORD");
  },
  get SESSION_SECRET() {
    return getEnvVar("SESSION_SECRET");
  },
};
