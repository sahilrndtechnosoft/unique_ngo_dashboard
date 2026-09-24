import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { CurrentUser, ResponseMessage } from '../common/decorators';
import { JwtPayload } from '../common/constants';
import { VerifyRazorpayPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders/:orderId/razorpay')
  @ApiBearerAuth()
  @ResponseMessage('Razorpay order created successfully')
  createRazorpayOrder(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.paymentsService.createRazorpayOrder(user.sub, orderId);
  }

  @Post('razorpay/verify')
  @ApiBearerAuth()
  @ResponseMessage('Payment verified successfully')
  verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyRazorpayPaymentDto) {
    return this.paymentsService.verifyRazorpayPayment(user.sub, dto);
  }

  @Post('razorpay/webhook')
  @Public()
  @ResponseMessage('Webhook accepted')
  webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') signature?: string) {
    if (!request.rawBody) throw new Error('Raw webhook body is not available');
    return this.paymentsService.handleWebhook(request.rawBody, signature);
  }
}
