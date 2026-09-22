import { Module } from '@nestjs/common';
import { RbacService } from './services/rbac.service';

@Module({
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
