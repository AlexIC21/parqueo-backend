import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface ParkingSpaceResponse {
  id: number;
  code: string;
  svgElementId: string;
  vehicleType: string;
  status: string;
  occupiedAt: string | null;
  updatedAt: string | null;
  lastMapUpdateAt?: string | null;
  minutesSinceLastUpdate?: number | null;
  isStale?: boolean;
  staleThresholdMinutes?: number;
}

const getSocketCorsOrigin = () => {
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    return ['http://localhost:8100', 'http://localhost:4200'];
  }

  return frontendUrl.split(',').map((origin) => origin.trim());
};

@WebSocketGateway({
  cors: {
    origin: getSocketCorsOrigin(),
    credentials: true,
  },
})
export class ParkingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  handleConnection() {
    return;
  }

  handleDisconnect() {
    return;
  }

  emitSpaceUpdated(space: ParkingSpaceResponse): void {
    this.server.emit('parking.space.updated', space);
  }

  emitIncidentCreated(payload: Record<string, unknown>): void {
    this.server.emit('incident.created', payload);
  }

  emitIncidentResolved(payload: Record<string, unknown>): void {
    this.server.emit('incident.resolved', payload);
  }

  emitIncidentCancelled(payload: Record<string, unknown>): void {
    this.server.emit('incident.cancelled', payload);
  }

  emitNotificationCreated(payload: Record<string, unknown>): void {
    this.server.emit('user.notification.created', payload);
  }

  emitScreenCounterUpdated(payload: unknown): void {
    this.server.emit('screen.counter.updated', payload);
  }

  emitContadorUpdated(payload: unknown): void {
    this.server.emit('contador.updated', payload);
  }
}
