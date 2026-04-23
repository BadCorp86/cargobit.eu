import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Export Job Status
 */
export type ExportJobStatus = 'queued' | 'running' | 'done' | 'failed';

/**
 * Export Job Format
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export Job Payload
 */
export interface ExportJobPayload {
  format?: ExportFormat;
  filter?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    userId?: string;
    minAmount?: number;
    maxAmount?: number;
  };
  requestedBy?: string;
}

/**
 * ExportJob Entity
 * Stores background export jobs for reconciliation reports
 */
@Entity('export_jobs')
export class ExportJob {
  @PrimaryColumn('uuid')
  id: string;

  @Column('jsonb', { nullable: true })
  payload: ExportJobPayload;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'queued',
  })
  @Index()
  status: ExportJobStatus;

  @Column({ type: 'text', nullable: true })
  result_url?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'integer', nullable: true })
  rows_exported?: number;

  @Column({ type: 'varchar', nullable: true })
  file_size?: string;

  @Column({ type: 'integer', nullable: true })
  duration_ms?: number;

  @CreateDateColumn()
  @Index()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  started_at?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completed_at?: Date;
}
