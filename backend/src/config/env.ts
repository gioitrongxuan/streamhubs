import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  isProduction: process.env.NODE_ENV === 'production',
  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'streamhub',
    password: process.env.DB_PASSWORD ?? 'streamhub',
    database: process.env.DB_NAME ?? 'streamhub',
  },
  jwt: {
    secret: process.env.NODE_ENV === 'production' ? required('JWT_SECRET') : (process.env.JWT_SECRET ?? 'dev-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  },
} as const;
