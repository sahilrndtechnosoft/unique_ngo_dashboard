import { Module } from '@nestjs/common';
import { RbacModule } from '../admin/rbac.module';
import { AdminSuggestionsController, SuggestionsController } from './controllers/suggestions.controller';
import { SuggestionsService } from './services/suggestions.service';

@Module({
  imports: [RbacModule],
  controllers: [SuggestionsController, AdminSuggestionsController],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
