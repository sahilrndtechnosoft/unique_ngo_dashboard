import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;

  app.setGlobalPrefix('api/v1');

  app.use(
    helmet({
      // Uploaded images are served cross-origin from the frontend's own domain.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const corsOrigins = configService.get<string[]>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Unique NGO Platform API')
    .setDescription(
      'Healthcare and social donation platform - Authentication & User APIs',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Shared auth (refresh, logout)')
    .addTag('Auth - User', 'User app login (OTP + email)')
    .addTag('Auth - Admin', 'Admin panel login (OTP + email)')
    .addTag('Auth - Seller', 'Seller app login (OTP + email) and registration')
    .addTag('Users', 'Profile management for users and sellers')
    .addTag('Admin - Roles', 'Create roles and assign module permissions')
    .addTag('Admin - Permissions', 'Permission catalog and user role assignment')
    .addTag('Admin - Settings', 'Company logo, details, and footer settings')
    .addTag('Admin - Banners', 'Homepage banner image management')
    .addTag('Admin - Users', 'Admin user management CRUD')
    .addTag('Admin - Sellers', 'Admin seller management CRUD')
    .addTag('Admin - Categories', 'Product category management')
    .addTag('Admin - Products', 'Admin product CRUD and approval')
    .addTag('Seller - Products', 'Seller product listing and management')
    .addTag('Categories', 'Public/active category listing')
    .addTag('Public - Settings', 'Public company settings and banners')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, '0.0.0.0');
  console.log(`Application running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
