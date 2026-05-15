import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface ParkingSpaceResponse {
  id: number;
  code: string;
  svgElementId: string;
  vehicleType: string;
  status: string;
  occupiedAt: string | null;
  updatedAt: string | null;
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

  handleConnection(_client: Socket) {
    return;
  }

  handleDisconnect(_client: Socket) {
    return;
  }

  emitSpaceUpdated(space: ParkingSpaceResponse): void {
    this.server.emit('parking.space.updated', space);
  }
}
