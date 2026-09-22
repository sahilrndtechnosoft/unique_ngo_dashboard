import { Body, Controller, Headers, Post } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { ShiprocketService } from '../services/shiprocket.service';

@Controller('webhooks')
export class ShiprocketWebhookController {
  constructor(private readonly shiprocket: ShiprocketService) {}

  @Public()
  @Post('delivery/status')
  receive(@Headers('x-api-key') apiKey: string | undefined, @Body() body: Record<string, any>) {
    return this.shiprocket.handleWebhook(apiKey, body ?? {});
  }
}
