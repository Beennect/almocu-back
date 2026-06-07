import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { RedisSubscriberService } from './redis-subscriber.service';

interface JwtPayload {
  sub: string;
  username: string;
  restaurantId?: string;
  role?: string;
  globalRoles?: string[];
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8081',
      'exp://127.0.0.1:8081',
      'exp://192.168.0.0/16:8081',
    ],
    credentials: true,
  },
  namespace: '/ws',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private subscribedChannels = new Set<string>();

  constructor(
    private configService: ConfigService,
    private redisSubscriber: RedisSubscriberService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extrai token dos headers de autenticação do Socket.io ou query param
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token — disconnecting`);
        client.emit('error', { message: 'Token de autenticação ausente' });
        client.disconnect();
        return;
      }

      const secret = this.configService.getOrThrow<string>('JWT_SECRET');
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as JwtPayload;

      const restaurantId = payload.restaurantId;
      if (!restaurantId) {
        this.logger.warn(
          `Client ${client.id} (${payload.sub}) has no restaurantId — disconnecting`,
        );
        client.emit('error', { message: 'Nenhum restaurante vinculado' });
        client.disconnect();
        return;
      }

      // Salva metadados no socket para uso posterior
      (client as any).user = {
        id: payload.sub,
        username: payload.username,
        restaurantId,
        role: payload.role,
      };

      // Entra na sala do restaurante
      const room = `restaurant:${restaurantId}`;
      await client.join(room);
      this.logger.log(
        `Client ${client.id} (user:${payload.sub}) connected and joined ${room}`,
      );

      // Inscreve nos canais Redis deste restaurante (apenas uma vez globalmente)
      const redisChannel = `realtime:${restaurantId}`;
      if (!this.subscribedChannels.has(redisChannel)) {
        this.subscribedChannels.add(redisChannel);
        await this.redisSubscriber.subscribe(redisChannel, (message) => {
          try {
            const event = JSON.parse(message);
            // Reencaminha para todos os sockets na sala do restaurante
            this.server.to(room).emit(event.type, event.payload);
          } catch (err) {
            this.logger.error(
              `Failed to parse Redis message on ${redisChannel}: ${(err as Error).message}`,
            );
          }
        });
        this.logger.log(`Subscribed to Redis channel: ${redisChannel}`);
      }

      client.emit('connected', { message: 'Conectado em tempo real' });
    } catch (error) {
      this.logger.error(
        `Connection error for client ${client.id}: ${(error as Error).message}`,
      );
      client.emit('error', { message: 'Erro de autenticação' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (user) {
      this.logger.log(
        `Client ${client.id} (user:${user.id}) disconnected from restaurant:${user.restaurantId}`,
      );

      // Não removemos a inscrição Redis aqui — outros clients do mesmo restaurante
      // podem ainda estar conectados. Só removemos se não houver mais ninguém na sala.
      const room = `restaurant:${user.restaurantId}`;
      const sockets = await this.server.in(room).fetchSockets();
      if (sockets.length === 0) {
        const redisChannel = `realtime:${user.restaurantId}`;
        await this.redisSubscriber.unsubscribe(redisChannel);
        this.subscribedChannels.delete(redisChannel);
        this.logger.log(
          `Last client left — unsubscribed from Redis channel: ${redisChannel}`,
        );
      }
    }
  }
}
