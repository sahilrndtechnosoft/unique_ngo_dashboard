import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.users.findFirst({
      where: {
        id: payload.sub,
        deleted_at: null,
        status: { notIn: ['SUSPENDED', 'BANNED'] },
      },
      select: { id: true, role: true, email: true, mobile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or account is inactive');
    }

    return {
      sub: user.id,
      role: user.role as JwtPayload['role'],
      email: user.email,
      mobile: user.mobile,
    };
  }
}
