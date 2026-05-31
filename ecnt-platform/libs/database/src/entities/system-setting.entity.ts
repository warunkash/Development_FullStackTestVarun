import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

export enum SettingValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

@Entity('system_settings')
@Index(['key'], { unique: true })
@Index(['category'])
export class SystemSettingEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'enum', enum: SettingValueType, default: SettingValueType.STRING })
  type: SettingValueType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'updated_by_id' })
  updatedBy: UserEntity | null;

  getTypedValue(): string | number | boolean | Record<string, unknown> {
    switch (this.type) {
      case SettingValueType.NUMBER:
        return parseFloat(this.value);
      case SettingValueType.BOOLEAN:
        return this.value === 'true';
      case SettingValueType.JSON:
        return JSON.parse(this.value) as Record<string, unknown>;
      default:
        return this.value;
    }
  }
}
