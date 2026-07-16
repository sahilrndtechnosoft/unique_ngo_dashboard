import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser, Public, ResponseMessage } from '../common/decorators';
import { JwtPayload } from '../common/constants';
import { AuthService } from './auth.service';
import { AuthPortal } from './constants/auth-portal';
import { LogoutDto, RefreshTokenDto } from './dto/auth.dto';
import { toSessionMetadata } from './dto/device-info.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

function createPortalAuthController(portal: AuthPortal, tag: string, path: string) {
  @ApiTags(tag)
  @Controller(path)
  @Public()
  class PortalAuthController {
    constructor(public readonly authService: AuthService) {}

    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60_000, limit: 5 } })
    @ResponseMessage('OTP sent successfully')
    @ApiOperation({ summary: `Send OTP for ${portal} login` })
    sendOtp(@Body() dto: SendOtpDto) {
      return this.authService.sendOtp(dto.mobileNumber, portal);
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @ResponseMessage('Login successful')
    @ApiOperation({ summary: `Verify OTP and login to ${portal} portal` })
    verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
      return this.authService.verifyOtp(
        dto.mobileNumber,
        dto.otp,
        portal,
        toSessionMetadata(dto, req),
      );
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { ttl: 60_000, limit: 10 } })
    @ResponseMessage('Login successful')
    @ApiOperation({ summary: `Email/password login to ${portal} portal` })
    login(@Body() dto: LoginDto, @Req() req: Request) {
      return this.authService.loginWithEmail(
        dto.email,
        dto.password,
        portal,
        toSessionMetadata(dto, req),
      );
    }
  }

  return PortalAuthController;
}

export const UserAuthController = createPortalAuthController(
  AuthPortal.USER,
  'Auth - User',
  'auth/user',
);

export const AdminAuthController = createPortalAuthController(
  AuthPortal.ADMIN,
  'Auth - Admin',
  'auth/admin',
);

export const SellerAuthController = createPortalAuthController(
  AuthPortal.SELLER,
  'Auth - Seller',
  'auth/seller',
);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Token refreshed successfully')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshToken(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  logout(@Body() dto: LogoutDto, @Req() req: Request) {
    return this.authService.logout(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ResponseMessage('Logged out from all devices successfully')
  @ApiOperation({ summary: 'Revoke all active refresh tokens for the current user' })
  logoutAll(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.authService.logoutAllDevices(user.sub, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ResponseMessage('Active sessions retrieved successfully')
  @ApiOperation({ summary: 'List active sessions for the current user' })
  getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getActiveSessions(user.sub);
  }
}
