import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AdminAuthController,
  AuthController,
  SellerAuthController,
  UserAuthController,
} from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './services/otp.service';
import { SmsService } from './services/sms.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwt.accessSecret')!,
        signOptions: {
          expiresIn: configService.get<string>('app.jwt.accessExpiresIn')! as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [
    UserAuthController,
    AdminAuthController,
    SellerAuthController,
    AuthController,
  ],
  providers: [AuthService, OtpService, TokenService, SmsService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
