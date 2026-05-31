import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OcppGateway } from './ocpp.gateway';

export interface RemoteStartTransactionPayload {
  connectorId: number;
  idTag: string;
  chargingProfile?: {
    chargingProfileId: number;
    stackLevel: number;
    chargingProfilePurpose: 'ChargePointMaxProfile' | 'TxDefaultProfile' | 'TxProfile';
    chargingProfileKind: 'Absolute' | 'Recurring' | 'Relative';
    chargingSchedule: {
      chargingRateUnit: 'A' | 'W';
      chargingSchedulePeriod: Array<{ startPeriod: number; limit: number; numberPhases?: number }>;
      duration?: number;
      startSchedule?: string;
      minChargingRate?: number;
    };
    transactionId?: number;
    validFrom?: string;
    validTo?: string;
  };
}

@Injectable()
export class OcppCommandsService {
  private readonly logger = new Logger(OcppCommandsService.name);

  constructor(private readonly gateway: OcppGateway) {}

  private ensureConnected(chargePointId: string): void {
    if (!this.gateway.isConnected(chargePointId)) {
      throw new NotFoundException(`ChargePoint ${chargePointId} is not connected`);
    }
  }

  async remoteStartTransaction(
    chargePointId: string,
    connectorId: number,
    idTag: string,
    chargingProfile?: RemoteStartTransactionPayload['chargingProfile'],
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`RemoteStartTransaction -> ${chargePointId} connector=${connectorId} tag=${idTag}`);
    return this.gateway.sendCall(chargePointId, 'RemoteStartTransaction', {
      connectorId,
      idTag,
      ...(chargingProfile && { chargingProfile }),
    });
  }

  async remoteStopTransaction(
    chargePointId: string,
    transactionId: number,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`RemoteStopTransaction -> ${chargePointId} txn=${transactionId}`);
    return this.gateway.sendCall(chargePointId, 'RemoteStopTransaction', { transactionId });
  }

  async changeAvailability(
    chargePointId: string,
    connectorId: number,
    type: 'Operative' | 'Inoperative',
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`ChangeAvailability -> ${chargePointId} connector=${connectorId} type=${type}`);
    return this.gateway.sendCall(chargePointId, 'ChangeAvailability', { connectorId, type });
  }

  async getConfiguration(
    chargePointId: string,
    keys?: string[],
  ): Promise<{ configurationKey: Array<{ key: string; readonly: boolean; value?: string }>; unknownKey?: string[] }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`GetConfiguration -> ${chargePointId} keys=${keys?.join(',') || 'all'}`);
    return this.gateway.sendCall(chargePointId, 'GetConfiguration', {
      ...(keys?.length && { key: keys }),
    });
  }

  async changeConfiguration(
    chargePointId: string,
    key: string,
    value: string,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`ChangeConfiguration -> ${chargePointId} ${key}=${value}`);
    return this.gateway.sendCall(chargePointId, 'ChangeConfiguration', { key, value });
  }

  async clearCache(chargePointId: string): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`ClearCache -> ${chargePointId}`);
    return this.gateway.sendCall(chargePointId, 'ClearCache', {});
  }

  async reset(
    chargePointId: string,
    type: 'Hard' | 'Soft',
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`Reset -> ${chargePointId} type=${type}`);
    return this.gateway.sendCall(chargePointId, 'Reset', { type });
  }

  async updateFirmware(
    chargePointId: string,
    location: string,
    retrieveDate: string,
    retries?: number,
    retryInterval?: number,
  ): Promise<Record<string, never>> {
    this.ensureConnected(chargePointId);
    this.logger.log(`UpdateFirmware -> ${chargePointId} location=${location}`);
    return this.gateway.sendCall(chargePointId, 'UpdateFirmware', {
      location,
      retrieveDate,
      ...(retries !== undefined && { retries }),
      ...(retryInterval !== undefined && { retryInterval }),
    });
  }

  async getDiagnostics(
    chargePointId: string,
    location: string,
    startTime?: string,
    stopTime?: string,
    retries?: number,
  ): Promise<{ fileName?: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`GetDiagnostics -> ${chargePointId} location=${location}`);
    return this.gateway.sendCall(chargePointId, 'GetDiagnostics', {
      location,
      ...(startTime && { startTime }),
      ...(stopTime && { stopTime }),
      ...(retries !== undefined && { retries }),
    });
  }

  async triggerMessage(
    chargePointId: string,
    requestedMessage: string,
    connectorId?: number,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`TriggerMessage -> ${chargePointId} message=${requestedMessage}`);
    return this.gateway.sendCall(chargePointId, 'TriggerMessage', {
      requestedMessage,
      ...(connectorId !== undefined && { connectorId }),
    });
  }

  async setChargingProfile(
    chargePointId: string,
    connectorId: number,
    chargingProfile: any,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`SetChargingProfile -> ${chargePointId} connector=${connectorId}`);
    return this.gateway.sendCall(chargePointId, 'SetChargingProfile', {
      connectorId,
      csChargingProfiles: chargingProfile,
    });
  }

  async clearChargingProfile(
    chargePointId: string,
    id?: number,
    connectorId?: number,
    chargingProfilePurpose?: string,
    stackLevel?: number,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`ClearChargingProfile -> ${chargePointId}`);
    return this.gateway.sendCall(chargePointId, 'ClearChargingProfile', {
      ...(id !== undefined && { id }),
      ...(connectorId !== undefined && { connectorId }),
      ...(chargingProfilePurpose && { chargingProfilePurpose }),
      ...(stackLevel !== undefined && { stackLevel }),
    });
  }

  async reserveNow(
    chargePointId: string,
    connectorId: number,
    expiryDate: string,
    idTag: string,
    reservationId: number,
    parentIdTag?: string,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`ReserveNow -> ${chargePointId} connector=${connectorId} reservationId=${reservationId}`);
    return this.gateway.sendCall(chargePointId, 'ReserveNow', {
      connectorId,
      expiryDate,
      idTag,
      reservationId,
      ...(parentIdTag && { parentIdTag }),
    });
  }

  async cancelReservation(
    chargePointId: string,
    reservationId: number,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`CancelReservation -> ${chargePointId} reservationId=${reservationId}`);
    return this.gateway.sendCall(chargePointId, 'CancelReservation', { reservationId });
  }

  async unlockConnector(
    chargePointId: string,
    connectorId: number,
  ): Promise<{ status: string }> {
    this.ensureConnected(chargePointId);
    this.logger.log(`UnlockConnector -> ${chargePointId} connector=${connectorId}`);
    return this.gateway.sendCall(chargePointId, 'UnlockConnector', { connectorId });
  }
}
