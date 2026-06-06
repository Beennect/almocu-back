import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

/** Tipo retornado por lean() — objeto plano sem métodos do Document */
type AuditLogEntry = Record<string, any>;

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    restaurantId: string;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    entityType: string;
    entityId: string;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    description?: string;
  }): Promise<void> {
    try {
      const entry = new this.auditModel(params);
      await entry.save();
    } catch (error) {
      // Audit nunca deve quebrar a operação principal
      console.error(`[AuditService] Falha ao registrar log: ${(error as Error).message}`, error);
    }
  }

  async findByEntity(
    restaurantId: string,
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<AuditLogEntry[]> {
    return this.auditModel
      .find({ restaurantId, entityType, entityId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findByType(
    restaurantId: string,
    entityType: string,
    limit = 100,
    skip = 0,
  ): Promise<{ items: AuditLogEntry[]; total: number }> {
    const [items, total] = await Promise.all([
      this.auditModel
        .find({ restaurantId, entityType })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditModel.countDocuments({ restaurantId, entityType }),
    ]);
    return { items, total };
  }
}
