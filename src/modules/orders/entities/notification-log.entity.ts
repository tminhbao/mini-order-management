import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', unique: true })
  orderId: number;

  @Column({ type: 'varchar', length: 255 })
  message: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}