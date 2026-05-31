import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private isFakeToken: boolean = false;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (!secretKey && !isProduction) {
      this.isFakeToken = true;
      this.logger.warn('STRIPE_SECRET_KEY not set. Using mock mode.');
    } else if (isProduction && !secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required in production mode');
    } else {
      this.stripe = new Stripe(secretKey!, {
        apiVersion: '2023-10-16',
      });
      this.logger.log('Stripe client initialized.');
    }
  }

  /**
   * Teste de conexão simples
   */
  async testConnection() {
    if (this.isFakeToken) {
      return {
        success: true,
        message: 'Mock: Conexão bem sucedida (Token Fictício)',
        data: { object: 'list', data: [], has_more: false },
      };
    }
    try {
      const customers = await this.stripe.customers.list({ limit: 1 });
      return {
        success: true,
        message: 'Conexão bem sucedida',
        data: customers,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Erro na chamada do Stripe:', message);
      return { success: false, message: 'Falha na conexão', error: message };
    }
  }

  /**
   * Cria uma sessão de Checkout para pagamento de um pedido.
   */
  async createCheckoutSession(
    items: { name: string; amount: number; quantity: number }[],
  ) {
    if (this.isFakeToken) {
      this.logger.log('Gerando Checkout Session Mockada...');
      return {
        success: true,
        url: 'https://checkout.stripe.mock/pay/cs_mock_123',
        sessionId: 'cs_mock_123',
      };
    }

    try {
      const line_items = items.map((item) => ({
        price_data: {
          currency: 'brl',
          product_data: {
            name: item.name,
          },
          unit_amount: item.amount, // em centavos
        },
        quantity: item.quantity,
      }));

      const successUrl = this.configService.get<string>(
        'STRIPE_SUCCESS_URL',
        'http://localhost:3000/success',
      );
      const cancelUrl = this.configService.get<string>(
        'STRIPE_CANCEL_URL',
        'http://localhost:3000/cancel',
      );

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items,
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
      });

      return {
        success: true,
        url: session.url,
        sessionId: session.id,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Erro ao criar Checkout Session:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Verifica o status de uma sessão de Checkout existente.
   * Substitui a necessidade de Webhooks para fluxos mais simples.
   */
  async verifySession(sessionId: string) {
    if (this.isFakeToken) {
      this.logger.log(`Verificando sessão mockada: ${sessionId}`);
      // Simula que a sessão mockada sempre foi paga
      return {
        success: true,
        paymentStatus: 'paid',
        customerEmail: 'mock@example.com',
      };
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      return {
        success: true,
        paymentStatus: session.payment_status, // 'paid', 'unpaid', ou 'no_payment_required'
        customerEmail: session.customer_details?.email,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao verificar sessão ${sessionId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }
}
