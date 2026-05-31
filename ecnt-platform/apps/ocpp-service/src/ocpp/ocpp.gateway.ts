import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { OcppMessageHandler } from './ocpp-message.handler';
import { ChargerEntity } from './entities/charger.entity';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout;
}

export interface ConnectedChargePoint {
  ws: WebSocket;
  chargePointId: string;
  ocppVersion: string;
  connectedAt: Date;
  remoteAddress: string;
  pendingRequests: Map<string, PendingRequest>;
}

@WebSocketGateway(9000, {
  path: '/ocpp',
  perMessageDeflate: false,
  // Allow subprotocols for OCPP 1.6 and 2.0.1
  handleProtocols: (protocols: Set<string>) => {
    if (protocols.has('ocpp2.0.1')) return 'ocpp2.0.1';
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    return 'ocpp1.6'; // default
  },
})
@Injectable()
export class OcppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OcppGateway.name);

  // Map: chargePointId -> ConnectedChargePoint
  private readonly connectedChargePoints = new Map<string, ConnectedChargePoint>();

  constructor(
    private readonly ocppMessageHandler: OcppMessageHandler,
    @InjectRepository(ChargerEntity)
    private readonly chargerRepo: Repository<ChargerEntity>,
  ) {}

  async handleConnection(client: WebSocket, request: any): Promise<void> {
    try {
      // Extract chargePointId from URL: /ocpp/{chargePointId}
      const url = request.url as string;
      const chargePointId = url.split('/').filter(Boolean).pop();

      if (!chargePointId) {
        this.logger.warn('Connection rejected: missing chargePointId in URL');
        client.close(1008, 'chargePointId required in path');
        return;
      }

      // Detect OCPP version from subprotocol header
      const protocol = request.headers?.['sec-websocket-protocol'] as string | undefined;
      const ocppVersion = protocol?.includes('ocpp2.0.1') ? '2.0.1' : '1.6';
      const remoteAddress = request.socket?.remoteAddress || 'unknown';

      this.logger.log(
        `ChargePoint connecting: ${chargePointId} (OCPP ${ocppVersion}) from ${remoteAddress}`,
      );

      // Close any existing connection for this chargePointId
      const existing = this.connectedChargePoints.get(chargePointId);
      if (existing) {
        this.logger.warn(`Replacing existing connection for ${chargePointId}`);
        existing.ws.close(1001, 'Superseded by new connection');
        this.connectedChargePoints.delete(chargePointId);
      }

      const chargePoint: ConnectedChargePoint = {
        ws: client,
        chargePointId,
        ocppVersion,
        connectedAt: new Date(),
        remoteAddress,
        pendingRequests: new Map(),
      };

      this.connectedChargePoints.set(chargePointId, chargePoint);

      // Update charger connection state in DB
      await this.chargerRepo.update(
        { ocppChargePointId: chargePointId },
        { status: 'available', lastHeartbeatAt: new Date() },
      );

      // Attach message handler
      client.on('message', (data: Buffer | string) => {
        this.handleMessage(chargePointId, data.toString()).catch((err) =>
          this.logger.error(`Unhandled error in message from ${chargePointId}: ${err.message}`),
        );
      });

      client.on('error', (err) => {
        this.logger.error(`WebSocket error for ${chargePointId}: ${err.message}`);
      });

      this.logger.log(`ChargePoint connected: ${chargePointId}`);
    } catch (err) {
      this.logger.error(`Error in handleConnection: ${err.message}`);
      client.close(1011, 'Internal error');
    }
  }

  async handleDisconnect(client: WebSocket): Promise<void> {
    for (const [id, cp] of this.connectedChargePoints.entries()) {
      if (cp.ws === client) {
        this.logger.log(`ChargePoint disconnected: ${id}`);

        // Cancel all pending requests
        cp.pendingRequests.forEach(({ reject, timeout }, uniqueId) => {
          clearTimeout(timeout);
          reject(new Error(`Connection closed while waiting for response to ${uniqueId}`));
        });

        this.connectedChargePoints.delete(id);

        // Mark charger as offline in DB
        await this.chargerRepo
          .update({ ocppChargePointId: id }, { status: 'offline' })
          .catch((err) => this.logger.error(`Failed to mark ${id} offline: ${err.message}`));

        break;
      }
    }
  }

  private async handleMessage(chargePointId: string, rawMessage: string): Promise<void> {
    let parsed: any[];
    try {
      parsed = JSON.parse(rawMessage);
    } catch (e) {
      this.logger.error(`Invalid JSON from ${chargePointId}: ${rawMessage.substring(0, 200)}`);
      return;
    }

    if (!Array.isArray(parsed) || parsed.length < 3) {
      this.logger.error(`Malformed OCPP message from ${chargePointId}`);
      return;
    }

    const messageType = parsed[0];

    switch (messageType) {
      case 2: {
        // CALL - request from charge point
        const [, uniqueId, action, payload] = parsed;
        await this.handleCall(chargePointId, uniqueId, action, payload || {});
        break;
      }
      case 3: {
        // CALLRESULT - response from charge point
        const [, uniqueId, payload] = parsed;
        this.handleCallResult(chargePointId, uniqueId, payload);
        break;
      }
      case 4: {
        // CALLERROR - error from charge point
        const [, uniqueId, errorCode, errorDescription] = parsed;
        this.handleCallError(chargePointId, uniqueId, errorCode, errorDescription);
        break;
      }
      default:
        this.logger.warn(`Unknown message type ${messageType} from ${chargePointId}`);
    }
  }

  private async handleCall(
    chargePointId: string,
    uniqueId: string,
    action: string,
    payload: any,
  ): Promise<void> {
    this.logger.debug(`CALL [${chargePointId}] ${action}: ${JSON.stringify(payload).substring(0, 200)}`);

    try {
      let response: any;

      switch (action) {
        case 'BootNotification':
          response = await this.ocppMessageHandler.handleBootNotification(chargePointId, payload);
          break;
        case 'Heartbeat':
          response = await this.ocppMessageHandler.handleHeartbeat(chargePointId);
          break;
        case 'Authorize':
          response = await this.ocppMessageHandler.handleAuthorize(chargePointId, payload);
          break;
        case 'StartTransaction':
          response = await this.ocppMessageHandler.handleStartTransaction(chargePointId, payload);
          break;
        case 'StopTransaction':
          response = await this.ocppMessageHandler.handleStopTransaction(chargePointId, payload);
          break;
        case 'MeterValues':
          response = await this.ocppMessageHandler.handleMeterValues(chargePointId, payload);
          break;
        case 'StatusNotification':
          response = await this.ocppMessageHandler.handleStatusNotification(chargePointId, payload);
          break;
        case 'DiagnosticsStatusNotification':
          response = await this.ocppMessageHandler.handleDiagnosticsStatus(chargePointId, payload);
          break;
        case 'FirmwareStatusNotification':
          response = await this.ocppMessageHandler.handleFirmwareStatus(chargePointId, payload);
          break;
        case 'DataTransfer':
          response = { status: 'Accepted' };
          break;
        default:
          this.logger.warn(`Unknown OCPP action: ${action} from ${chargePointId}`);
          this.sendCallError(chargePointId, uniqueId, 'NotImplemented', `Action ${action} is not supported`);
          return;
      }

      this.sendCallResult(chargePointId, uniqueId, response);
    } catch (error) {
      this.logger.error(`Error handling ${action} from ${chargePointId}: ${error.message}`);
      this.sendCallError(chargePointId, uniqueId, 'InternalError', error.message);
    }
  }

  private handleCallResult(chargePointId: string, uniqueId: string, payload: any): void {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) return;

    const pending = cp.pendingRequests.get(uniqueId);
    if (pending) {
      clearTimeout(pending.timeout);
      cp.pendingRequests.delete(uniqueId);
      pending.resolve(payload);
    } else {
      this.logger.warn(`Received CALLRESULT for unknown uniqueId ${uniqueId} from ${chargePointId}`);
    }
  }

  private handleCallError(
    chargePointId: string,
    uniqueId: string,
    errorCode: string,
    errorDescription: string,
  ): void {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) return;

    const pending = cp.pendingRequests.get(uniqueId);
    if (pending) {
      clearTimeout(pending.timeout);
      cp.pendingRequests.delete(uniqueId);
      pending.reject(new Error(`OCPP Error [${errorCode}]: ${errorDescription}`));
    }
  }

  sendCallResult(chargePointId: string, uniqueId: string, payload: any): void {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) {
      this.logger.warn(`Cannot send CALLRESULT to disconnected chargePoint ${chargePointId}`);
      return;
    }

    const message = JSON.stringify([3, uniqueId, payload]);
    this.logger.debug(`CALLRESULT [${chargePointId}] ${uniqueId}: ${message.substring(0, 200)}`);
    cp.ws.send(message);
  }

  sendCallError(
    chargePointId: string,
    uniqueId: string,
    errorCode: string,
    errorDescription: string,
    errorDetails: Record<string, any> = {},
  ): void {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) return;

    const message = JSON.stringify([4, uniqueId, errorCode, errorDescription, errorDetails]);
    cp.ws.send(message);
  }

  async sendCall(
    chargePointId: string,
    action: string,
    payload: any,
    timeoutMs: number = 30000,
  ): Promise<any> {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) {
      throw new Error(`ChargePoint ${chargePointId} is not connected`);
    }
    if (cp.ws.readyState !== cp.ws.OPEN) {
      throw new Error(`ChargePoint ${chargePointId} WebSocket is not open (state: ${cp.ws.readyState})`);
    }

    const uniqueId = uuidv4();
    const message = JSON.stringify([2, uniqueId, action, payload]);

    this.logger.debug(`CALL -> [${chargePointId}] ${action} (${uniqueId})`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cp.pendingRequests.delete(uniqueId);
        reject(new Error(`Request ${action} timed out after ${timeoutMs}ms for ${chargePointId}`));
      }, timeoutMs);

      cp.pendingRequests.set(uniqueId, { resolve, reject, timeout });
      cp.ws.send(message, (err) => {
        if (err) {
          clearTimeout(timeout);
          cp.pendingRequests.delete(uniqueId);
          reject(new Error(`Failed to send ${action} to ${chargePointId}: ${err.message}`));
        }
      });
    });
  }

  isConnected(chargePointId: string): boolean {
    const cp = this.connectedChargePoints.get(chargePointId);
    return cp?.ws.readyState === WebSocket.OPEN;
  }

  getConnectedChargePoints(): string[] {
    return Array.from(this.connectedChargePoints.keys()).filter((id) => this.isConnected(id));
  }

  getChargePointInfo(chargePointId: string): Omit<ConnectedChargePoint, 'ws' | 'pendingRequests'> | null {
    const cp = this.connectedChargePoints.get(chargePointId);
    if (!cp) return null;
    const { ws, pendingRequests, ...info } = cp;
    return info;
  }
}
