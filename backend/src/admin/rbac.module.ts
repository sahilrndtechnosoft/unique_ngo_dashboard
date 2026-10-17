import { Global, Module } from '@nestjs/common';
import { RbacService } from './services/rbac.service';

@Global()
@Module({
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
