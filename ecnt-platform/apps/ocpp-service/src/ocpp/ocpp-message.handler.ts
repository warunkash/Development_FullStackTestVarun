import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChargerEntity } from './entities/charger.entity';
import { SessionEntity } from './entities/session.entity';
import { MeterValueEntity } from './entities/meter-value.entity';

const OCPP_TO_DB_STATUS: Record<string, string> = {
  Available: 'available',
  Preparing: 'preparing',
  Charging: 'occupied',
  SuspendedEVSE: 'occupied',
  SuspendedEV: 'occupied',
  Finishing: 'occupied',
  Reserved: 'reserved',
  Unavailable: 'offline',
  Faulted: 'faulted',
};

@Injectable()
export class OcppMessageHandler {
  private readonly logger = new Logger(OcppMessageHandler.name);

  constructor(
    @InjectRepository(ChargerEntity)
    private readonly chargerRepo: Repository<ChargerEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    @InjectRepository(MeterValueEntity)
    private readonly meterValueRepo: Repository<MeterValueEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleBootNotification(
    chargePointId: string,
    payload: {
      chargePointVendor: string;
      chargePointModel: string;
      chargePointSerialNumber?: string;
      firmwareVersion?: string;
      iccid?: string;
      imsi?: string;
      meterType?: string;
      meterSerialNumber?: string;
    },
  ): Promise<{ status: string; currentTime: string; interval: number }> {
    this.logger.log(
      `BootNotification from ${chargePointId}: ${payload.chargePointVendor} ${payload.chargePointModel}`,
    );

    await this.chargerRepo.update(
      { ocppChargePointId: chargePointId },
      {
        manufacturer: payload.chargePointVendor,
        model: payload.chargePointModel,
        firmwareVersion: payload.firmwareVersion || undefined,
        lastHeartbeatAt: new Date(),
        status: 'available',
      },
    );

    this.eventEmitter.emit('charger.boot', {
      chargePointId,
      vendor: payload.chargePointVendor,
      model: payload.chargePointModel,
      firmwareVersion: payload.firmwareVersion,
    });

    return {
      status: 'Accepted',
      currentTime: new Date().toISOString(),
      interval: 300, // 5-minute heartbeat interval
    };
  }

  async handleHeartbeat(chargePointId: string): Promise<{ currentTime: string }> {
    await this.chargerRepo.update(
      { ocppChargePointId: chargePointId },
      { lastHeartbeatAt: new Date() },
    );

    this.logger.debug(`Heartbeat from ${chargePointId}`);
    return { currentTime: new Date().toISOString() };
  }

  async handleAuthorize(
    chargePointId: string,
    payload: { idTag: string },
  ): Promise<{ idTagInfo: { status: string; expiryDate?: string } }> {
    this.logger.log(`Authorize request from ${chargePointId}: idTag=${payload.idTag}`);

    const isAuthorized = await this.checkAuthorization(payload.idTag);

    const response = {
      idTagInfo: {
        status: isAuthorized ? 'Accepted' : 'Invalid',
        ...(isAuthorized && {
          expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }),
      },
    };

    this.eventEmitter.emit('charger.authorize', {
      chargePointId,
      idTag: payload.idTag,
      status: response.idTagInfo.status,
    });

    return response;
  }

  async handleStartTransaction(
    chargePointId: string,
    payload: {
      connectorId: number;
      idTag: string;
      meterStart: number;
      timestamp: string;
      reservationId?: number;
    },
  ): Promise<{ transactionId: number; idTagInfo: { status: string } }> {
    this.logger.log(
      `StartTransaction from ${chargePointId}: connector=${payload.connectorId} idTag=${payload.idTag}`,
    );

    const charger = await this.chargerRepo.findOne({
      where: { ocppChargePointId: chargePointId },
    });

    if (!charger) {
      this.logger.error(`StartTransaction: charger ${chargePointId} not found in DB`);
      return { transactionId: 0, idTagInfo: { status: 'Invalid' } };
    }

    // Resolve userId from idTag
    const userId = await this.getUserFromIdTag(payload.idTag);

    // Create session record
    const now = new Date(payload.timestamp);
    const sessionId = `TXN_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${Date.now().toString().slice(-6)}`;

    const session = this.sessionRepo.create({
      sessionId,
      userId,
      stationId: charger.stationId,
      chargerId: charger.id,
      connectorId: payload.connectorId.toString(),
      status: 'active',
      startTime: now,
      meterStart: payload.meterStart,
      energyDeliveredKwh: 0,
    });

    const savedSession = await this.sessionRepo.save(session);

    // Update charger status
    await this.chargerRepo.update(charger.id, { status: 'occupied' });

    // Generate OCPP transaction ID (must be integer)
    const transactionId = parseInt(
      savedSession.id.replace(/-/g, '').substring(0, 8),
      16,
    ) % 2147483647; // Max signed 32-bit int

    // Store transactionId on session
    await this.sessionRepo.update(savedSession.id, { ocppTransactionId: transactionId });

    this.logger.log(`Session started: ${savedSession.sessionId} (txn: ${transactionId})`);

    this.eventEmitter.emit('charging.session.started', {
      sessionId: savedSession.id,
      ocppTransactionId: transactionId,
      chargerId: charger.id,
      stationId: charger.stationId,
      userId,
      connectorId: payload.connectorId,
    });

    return {
      transactionId,
      idTagInfo: { status: 'Accepted' },
    };
  }

  async handleStopTransaction(
    chargePointId: string,
    payload: {
      transactionId: number;
      meterStop: number;
      timestamp: string;
      reason?: string;
      idTag?: string;
      transactionData?: any[];
    },
  ): Promise<{ idTagInfo: { status: string } }> {
    this.logger.log(
      `StopTransaction from ${chargePointId}: txn=${payload.transactionId} meterStop=${payload.meterStop}`,
    );

    const charger = await this.chargerRepo.findOne({
      where: { ocppChargePointId: chargePointId },
    });

    if (!charger) {
      this.logger.error(`StopTransaction: charger ${chargePointId} not found`);
      return { idTagInfo: { status: 'Invalid' } };
    }

    const session = await this.sessionRepo.findOne({
      where: { chargerId: charger.id, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    if (session) {
      const endTime = new Date(payload.timestamp);
      const energyKwh = session.meterStart !== null
        ? (payload.meterStop - Number(session.meterStart)) / 1000
        : 0;
      const durationSeconds = (endTime.getTime() - session.startTime.getTime()) / 1000;

      await this.sessionRepo.update(session.id, {
        status: 'completed',
        endTime,
        meterStop: payload.meterStop,
        energyDeliveredKwh: Math.max(0, energyKwh),
        stopReason: payload.reason || 'Local',
      });

      // Process any inline transaction data (meter values)
      if (payload.transactionData && payload.transactionData.length > 0) {
        await this.saveMeterValuesFromTransactionData(session.id, payload.transactionData);
      }

      // Mark charger available
      await this.chargerRepo.update(charger.id, { status: 'available' });

      this.logger.log(`Session stopped: ${session.sessionId} - energy: ${energyKwh.toFixed(3)} kWh`);

      this.eventEmitter.emit('charging.session.stopped', {
        sessionId: session.id,
        ocppTransactionId: payload.transactionId,
        energyKwh: Math.max(0, energyKwh),
        durationSeconds,
        userId: session.userId,
        stationId: charger.stationId,
        chargerId: charger.id,
        stopReason: payload.reason,
      });
    } else {
      this.logger.warn(
        `StopTransaction: no active session found for charger ${chargePointId} txn=${payload.transactionId}`,
      );
    }

    return { idTagInfo: { status: 'Accepted' } };
  }

  async handleMeterValues(
    chargePointId: string,
    payload: {
      connectorId: number;
      transactionId?: number;
      meterValue: Array<{
        timestamp: string;
        sampledValue: Array<{
          value: string;
          context?: string;
          format?: string;
          measurand?: string;
          phase?: string;
          location?: string;
          unit?: string;
        }>;
      }>;
    },
  ): Promise<Record<string, never>> {
    const charger = await this.chargerRepo.findOne({
      where: { ocppChargePointId: chargePointId },
    });

    if (!charger) return {};

    const session = await this.sessionRepo.findOne({
      where: { chargerId: charger.id, status: 'active' },
      order: { createdAt: 'DESC' },
    });

    if (!session || !payload.meterValue?.length) return {};

    const meterValueEntities = payload.meterValue.map((mv) => {
      const sampledValues = mv.sampledValue || [];

      const find = (measurand: string) =>
        sampledValues.find((sv) => sv.measurand === measurand);

      const energy = find('Energy.Active.Import.Register');
      const power = find('Power.Active.Import');
      const soc = find('SoC');
      const voltage = find('Voltage');
      const current = find('Current.Import');

      const energyKwh = energy
        ? parseFloat(energy.value) / (energy.unit === 'Wh' ? 1000 : 1)
        : 0;

      return this.meterValueRepo.create({
        sessionId: session.id,
        timestamp: new Date(mv.timestamp),
        energyKwh,
        powerKw: power ? parseFloat(power.value) / (power.unit === 'W' ? 1000 : 1) : undefined,
        soc: soc ? parseFloat(soc.value) : undefined,
        voltage: voltage ? parseFloat(voltage.value) : undefined,
        current: current ? parseFloat(current.value) : undefined,
        rawSampledValues: mv.sampledValue,
      });
    });

    await this.meterValueRepo.save(meterValueEntities);

    // Update session with latest energy reading
    const latestEnergy = meterValueEntities[meterValueEntities.length - 1]?.energyKwh;
    if (latestEnergy) {
      await this.sessionRepo.update(session.id, { energyDeliveredKwh: latestEnergy });
    }

    this.eventEmitter.emit('charging.meter.values', {
      sessionId: session.id,
      chargerId: charger.id,
      stationId: charger.stationId,
      latestEnergyKwh: latestEnergy,
    });

    return {};
  }

  async handleStatusNotification(
    chargePointId: string,
    payload: {
      connectorId: number;
      status: string;
      errorCode: string;
      info?: string;
      timestamp?: string;
      vendorId?: string;
      vendorErrorCode?: string;
    },
  ): Promise<Record<string, never>> {
    this.logger.log(
      `StatusNotification from ${chargePointId}: connector=${payload.connectorId} status=${payload.status} errorCode=${payload.errorCode}`,
    );

    const charger = await this.chargerRepo.findOne({
      where: { ocppChargePointId: chargePointId },
    });

    if (!charger) return {};

    const newStatus = OCPP_TO_DB_STATUS[payload.status] || 'offline';

    // Update connector-level status
    const connectorStatuses = { ...(charger.connectorStatuses || {}) };
    connectorStatuses[payload.connectorId.toString()] = {
      status: payload.status,
      errorCode: payload.errorCode,
      info: payload.info,
      lastUpdated: new Date().toISOString(),
    };

    // Connector 0 means the charger itself
    if (payload.connectorId === 0) {
      await this.chargerRepo.update(charger.id, {
        status: newStatus,
        connectorStatuses,
        ...(payload.status === 'Faulted' && {
          lastFaultAt: new Date(),
          lastFaultCode: payload.errorCode,
          lastFaultInfo: payload.info || payload.vendorErrorCode,
        }),
      } as any);
    } else {
      await this.chargerRepo.update(charger.id, { connectorStatuses });
      // Derive overall charger status from all connector statuses
      const allStatuses = Object.entries(connectorStatuses)
        .filter(([k]) => k !== '0')
        .map(([, v]: [string, any]) => v.status);

      let overallStatus = newStatus;
      if (allStatuses.every((s: string) => s === 'Available')) overallStatus = 'available';
      else if (allStatuses.some((s: string) => s === 'Charging' || s === 'SuspendedEVSE' || s === 'SuspendedEV')) overallStatus = 'occupied';
      else if (allStatuses.some((s: string) => s === 'Faulted')) overallStatus = 'faulted';

      await this.chargerRepo.update(charger.id, { status: overallStatus } as any);
    }

    if (payload.status === 'Faulted') {
      this.eventEmitter.emit('charger.fault', {
        chargerId: charger.id,
        stationId: charger.stationId,
        chargePointId,
        errorCode: payload.errorCode,
        info: payload.info,
        connectorId: payload.connectorId,
      });
    }

    this.eventEmitter.emit('charger.status.changed', {
      chargerId: charger.id,
      stationId: charger.stationId,
      ocppStatus: payload.status,
      dbStatus: newStatus,
      connectorId: payload.connectorId,
    });

    return {};
  }

  async handleDiagnosticsStatus(
    chargePointId: string,
    payload: { status: string },
  ): Promise<Record<string, never>> {
    this.logger.log(`DiagnosticsStatus from ${chargePointId}: ${payload.status}`);
    this.eventEmitter.emit('charger.diagnostics.status', { chargePointId, status: payload.status });
    return {};
  }

  async handleFirmwareStatus(
    chargePointId: string,
    payload: { status: string },
  ): Promise<Record<string, never>> {
    this.logger.log(`FirmwareStatus from ${chargePointId}: ${payload.status}`);

    const charger = await this.chargerRepo.findOne({ where: { ocppChargePointId: chargePointId } });
    if (charger && payload.status === 'Installed') {
      // Clear pending firmware URL after successful install
      await this.chargerRepo.update(charger.id, { pendingFirmwareUrl: null } as any);
    }

    this.eventEmitter.emit('charger.firmware.status', {
      chargePointId,
      chargerId: charger?.id,
      status: payload.status,
    });

    return {};
  }

  private async saveMeterValuesFromTransactionData(
    sessionId: string,
    transactionData: any[],
  ): Promise<void> {
    try {
      const entities = transactionData.flatMap((mv) =>
        (mv.sampledValue || []).map((sv: any) => {
          const energy = mv.sampledValue?.find(
            (s: any) => s.measurand === 'Energy.Active.Import.Register',
          );
          return this.meterValueRepo.create({
            sessionId,
            timestamp: new Date(mv.timestamp),
            energyKwh: energy ? parseFloat(energy.value) / 1000 : 0,
            rawSampledValues: mv.sampledValue,
          });
        }),
      );
      if (entities.length > 0) {
        await this.meterValueRepo.save(entities);
      }
    } catch (err) {
      this.logger.error(`Failed to save transaction data meter values: ${err.message}`);
    }
  }

  private async checkAuthorization(idTag: string): Promise<boolean> {
    // TODO: Implement actual RFID tag lookup in vehicles table
    // For now, accept all tags (whitelist mode would reject unknown tags)
    if (!idTag || idTag.trim() === '') return false;
    // In production: query vehicles table where rfidTag = idTag and isActive = true
    return true;
  }

  private async getUserFromIdTag(idTag: string): Promise<string | null> {
    // TODO: Implement actual lookup in vehicles/users table
    // SELECT user_id FROM vehicles WHERE rfid_tag = $1 LIMIT 1
    return null;
  }
}
