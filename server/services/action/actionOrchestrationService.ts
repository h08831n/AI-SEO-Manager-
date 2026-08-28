/**
 * ActionOrchestrationService (Facade)
 * 
 * Delegates all execution and rollback calls exclusively to ActionExecutionPipeline.
 * Guarantees a single authoritative execution path throughout the system.
 */

import { ActionStatus } from '@prisma/client';
import {
  ActionExecutionPipeline,
  ActionPipelineInput,
  ActionExecutionPipelineParams,
  ActionExecutionPipelineResult,
} from './actionExecutionPipeline';

export interface ExecuteActionParams {
  websiteId: string;
  taskId?: string;
  recommendationId?: string;
  actionType: string;
  targetUrl: string;
  payload: Record<string, any>;
  idempotencyKey: string;
  userId?: string;
  userRole?: string;
  isDryRun?: boolean;
  autoVerify?: boolean;
  platform?: string;
  executionMode?: 'MANUAL' | 'AUTONOMOUS' | 'CANARY';
  correlationId?: string;
}

export class ActionOrchestrationService {
  /**
   * Delegates mutation execution to the authoritative ActionExecutionPipeline.
   */
  public static async executeAction(params: ExecuteActionParams): Promise<{
    success: boolean;
    actionExecutionId: string;
    state: ActionStatus;
    preStateSnapshot?: any;
    appliedState?: any;
    diffSummary?: string;
    verificationResult?: any;
    rolledBack?: boolean;
    message?: string;
    isDuplicate?: boolean;
  }> {
    const pipelineParams: ActionExecutionPipelineParams = {
      websiteId: params.websiteId,
      taskId: params.taskId,
      recommendationId: params.recommendationId,
      actionType: params.actionType,
      targetUrl: params.targetUrl,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
      executionMode: params.executionMode || (params.userId ? 'MANUAL' : 'AUTONOMOUS'),
      userId: params.userId,
      userRole: params.userRole,
      isDryRun: params.isDryRun,
      autoVerify: params.autoVerify,
      platform: params.platform,
      correlationId: params.correlationId,
    };

    const res = await ActionExecutionPipeline.execute(pipelineParams);

    return {
      success: res.success,
      actionExecutionId: res.actionExecutionId,
      state: res.state,
      preStateSnapshot: res.preStateSnapshot,
      appliedState: res.appliedState,
      diffSummary: res.diffSummary,
      verificationResult: res.verificationResult,
      rolledBack: res.rolledBack,
      message: res.message,
      isDuplicate: res.isDuplicate,
    };
  }

  /**
   * Delegates rollback to the authoritative ActionExecutionPipeline.
   */
  public static async rollbackAction(params: {
    actionExecutionId: string;
    websiteId: string;
    reason?: string;
    userId?: string;
    platform?: string;
  }): Promise<{ success: boolean; message: string; restoredState: any }> {
    return await ActionExecutionPipeline.rollback(params);
  }
}
