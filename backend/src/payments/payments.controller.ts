import { Body, Controller, Headers, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Create or reuse a Razorpay order for a pending local order' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Razorpay order details returned for checkout' })
  @ResponseMessage('Razorpay order created successfully')
  createRazorpayOrder(@CurrentUser() user: JwtPayload, @Param('orderId') orderId: string) {
    return this.paymentsService.createRazorpayOrder(user.sub, orderId);
  }

  @Post('razorpay/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a Razorpay payment server-side and confirm the order' })
  @ApiResponse({ status: 201, description: 'Payment verified and order status synchronized' })
  @ResponseMessage('Payment verified successfully')
  verify(@CurrentUser() user: JwtPayload, @Body() dto: VerifyRazorpayPaymentDto) {
    return this.paymentsService.verifyRazorpayPayment(user.sub, dto);
  }

  @Post('razorpay/webhook')
  @Public()
  @ApiOperation({ summary: 'Receive an idempotent Razorpay payment webhook' })
  @ApiHeader({ name: 'x-razorpay-signature', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      description: 'Razorpay webhook payload. The signature is verified against the raw request body.',
      additionalProperties: true,
    },
  })
  @ApiResponse({ status: 201, description: 'Webhook accepted after signature validation' })
  @ResponseMessage('Webhook accepted')
  webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('x-razorpay-signature') signature?: string) {
    if (!request.rawBody) throw new Error('Raw webhook body is not available');
    return this.paymentsService.handleWebhook(request.rawBody, signature);
  }
}
