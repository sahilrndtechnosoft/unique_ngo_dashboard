import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5', 10),
  exposeOtpInResponse: process.env.EXPOSE_OTP_IN_RESPONSE === 'true',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
}));
