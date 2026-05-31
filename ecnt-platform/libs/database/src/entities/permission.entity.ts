import { Entity, Column, Index, ManyToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { RoleEntity } from './role.entity';

@Entity('permissions')
@Index(['name'], { unique: true })
export class PermissionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  resource: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles: RoleEntity[];
}
