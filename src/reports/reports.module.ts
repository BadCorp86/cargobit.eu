import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { ExportJob } from './entities/export-job.entity';
import { ReportsMetricsService } from './metrics/reports.metrics';

@Module({
  imports: [TypeOrmModule.forFeature([ExportJob])],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsMetricsService],
  exports: [ReportsService, ReportsMetricsService],
})
export class ReportsModule {}
