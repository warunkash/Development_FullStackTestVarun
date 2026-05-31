import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChargerEntity } from '../ocpp/entities/charger.entity';
import { OcppGateway } from '../ocpp/ocpp.gateway';

@Injectable()
export class HeartbeatScheduler {
  private readonly logger = new Logger(HeartbeatScheduler.name);
  private readonly OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(ChargerEntity)
    private readonly chargerRepo: Repository<ChargerEntity>,
    private readonly gateway: OcppGateway,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkChargerHeartbeats(): Promise<void> {
    const threshold = new Date(Date.now() - this.OFFLINE_THRESHOLD_MS);

    // Find chargers that SHOULD be online (not explicitly offline or maintenance)
    // but haven't sent a heartbeat in > 5 minutes
    const staleChargers = await this.chargerRepo
      .createQueryBuilder('charger')
      .where('charger.status NOT IN (:...skippedStatuses)', {
        skippedStatuses: ['offline', 'maintenance'],
      })
      .andWhere(
        '(charger.lastHeartbeatAt IS NULL OR charger.lastHeartbeatAt < :threshold)',
        { threshold },
      )
      .getMany();

    if (staleChargers.length === 0) return;

    this.logger.warn(
      `Found ${staleChargers.length} chargers with stale heartbeat (>${this.OFFLINE_THRESHOLD_MS / 60000}min)`,
    );

    for (const charger of staleChargers) {
      // Double-check: is it still actually connected to the WebSocket?
      const stillConnected = this.gateway.isConnected(charger.ocppChargePointId);

      if (!stillConnected) {
        // Mark as offline in DB
        await this.chargerRepo.update(charger.id, { status: 'offline' });

        this.logger.warn(
          `Charger ${charger.ocppChargePointId} marked offline (no heartbeat since ${charger.lastHeartbeatAt?.toISOString() || 'never'})`,
        );

        this.eventEmitter.emit('charger.offline', {
          chargerId: charger.id,
          stationId: charger.stationId,
          ocppChargePointId: charger.ocppChargePointId,
          lastHeartbeatAt: charger.lastHeartbeatAt,
        });
      } else {
        // Still connected but no heartbeat - trigger a heartbeat
        try {
          await this.gateway.sendCall(charger.ocppChargePointId, 'TriggerMessage', {
            requestedMessage: 'Heartbeat',
          });
          this.logger.debug(`Triggered heartbeat for stale charger ${charger.ocppChargePointId}`);
        } catch (err) {
          this.logger.error(
            `Failed to trigger heartbeat for ${charger.ocppChargePointId}: ${err.message}`,
          );
          await this.chargerRepo.update(charger.id, { status: 'offline' });

          this.eventEmitter.emit('charger.offline', {
            chargerId: charger.id,
            stationId: charger.stationId,
            ocppChargePointId: charger.ocppChargePointId,
            lastHeartbeatAt: charger.lastHeartbeatAt,
          });
        }
      }
    }
  }

  @Cron('0 */5 * * * *') // Every 5 minutes
  async logConnectionStats(): Promise<void> {
    const connected = this.gateway.getConnectedChargePoints();
    const totalActive = await this.chargerRepo.count({
      where: { status: 'available' } as any,
    });
    const totalOffline = await this.chargerRepo.count({
      where: { status: 'offline' } as any,
    });

    this.logger.log(
      `OCPP Stats: WebSocket connected=${connected.length}, DB active=${totalActive}, DB offline=${totalOffline}`,
    );
  }
}
