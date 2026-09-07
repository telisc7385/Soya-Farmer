import prisma from "../database/prisma";

type LogActivityInput = {
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  remark?: string | null;
  createdById: string;
};

export const logActivity = (input: LogActivityInput) => {
  return prisma.activityLog.create({
    data: {
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      remark: input.remark ?? null,
      createdById: input.createdById,
    },
  });
};