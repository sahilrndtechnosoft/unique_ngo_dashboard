import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AppModule, JwtPayload, PermissionAction, UserRole } from '../../common/constants';
import { CurrentUser, RequirePermissions, ResponseMessage, Roles } from '../../common/decorators';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateDonationSheetRecordDto,
  ImportDonationSheetDto,
  ListDonationSheetRecordsQueryDto,
  MatchDonationSheetRecordDto,
  UpdateDonationSheetRecordDto,
} from '../dto/sheet-import.dto';
import { SheetImportService } from '../services/sheet-import.service';

@ApiTags('Admin - Donation Sheet Reconciliation')
@ApiBearerAuth()
@Controller('admin/donation-sheet-imports')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class SheetImportController {
  constructor(private readonly sheetImportService: SheetImportService) {}

  @Post()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Sheet imported successfully')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        hospitalId: { type: 'string' },
        campaignId: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportDonationSheetDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('A CSV file exported from the connected sheet is required');
    }
    return this.sheetImportService.importSheet(file.buffer, dto, user.sub);
  }

  @Post('manual')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.CREATE)
  @ResponseMessage('Sheet record created successfully')
  createManual(@Body() dto: CreateDonationSheetRecordDto, @CurrentUser() user: JwtPayload) {
    return this.sheetImportService.createRecord(dto, user.sub);
  }

  @Get()
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Sheet records fetched successfully')
  list(@Query() query: ListDonationSheetRecordsQueryDto) {
    return this.sheetImportService.listRecords(query);
  }

  @Get(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Sheet record fetched successfully')
  get(@Param('id') id: string) {
    return this.sheetImportService.getRecord(id);
  }

  @Get(':id/candidates')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.VIEW)
  @ResponseMessage('Candidate donations fetched successfully')
  candidates(@Param('id') id: string) {
    return this.sheetImportService.getCandidates(id);
  }

  @Patch(':id')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Sheet record updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdateDonationSheetRecordDto) {
    return this.sheetImportService.updateRecord(id, dto);
  }

  @Patch(':id/match')
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.EDIT)
  @ResponseMessage('Sheet record matched to donation')
  match(@Param('id') id: string, @Body() dto: MatchDonationSheetRecordDto) {
    return this.sheetImportService.matchRecord(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(AppModule.BLOOD_BANK, PermissionAction.DELETE)
  @ResponseMessage('Sheet record deleted successfully')
  delete(@Param('id') id: string) {
    return this.sheetImportService.deleteRecord(id);
  }
}
