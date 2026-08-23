import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

export interface StructuredDataPayload {
  targetUrl: string;
  schemaType: string;
  schemaJsonLd: Record<string, any>;
}

export interface StructuredDataPreState {
  targetUrl: string;
  previousSchemas: Record<string, any>[];
  capturedAt: string;
}

const liveSchemaRegistry: Map<string, Record<string, any>[]> = new Map();

export class StructuredDataActionExecutor implements IActionExecutor<StructuredDataPayload, StructuredDataPreState> {
  readonly actionType: ActionType = 'INJECT_STRUCTURED_DATA';

  async validate(target: ActionTarget, payload: StructuredDataPayload): Promise<ValidationResult> {
    if (!payload.schemaJsonLd || typeof payload.schemaJsonLd !== 'object') {
      return { valid: false, errors: ['schemaJsonLd must be a valid JSON object'] };
    }
    if (!payload.schemaJsonLd['@context'] || !payload.schemaJsonLd['@type']) {
      return { valid: false, errors: ['JSON-LD must include @context and @type'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<StructuredDataPreState> {
    const existing = liveSchemaRegistry.get(target.targetUrl) || [];
    return {
      targetUrl: target.targetUrl,
      previousSchemas: JSON.parse(JSON.stringify(existing)),
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: StructuredDataPayload,
    preState: StructuredDataPreState
  ): Promise<ExecutionResult> {
    const schemas = liveSchemaRegistry.get(target.targetUrl) || [];
    schemas.push(payload.schemaJsonLd);
    liveSchemaRegistry.set(target.targetUrl, schemas);

    return {
      success: true,
      actionId: `exec-schema-${Date.now()}`,
      appliedState: { injectedSchema: payload.schemaJsonLd },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: `Successfully injected ${payload.schemaType} structured data`,
      diffSummary: `Injected schema @type: ${payload.schemaJsonLd['@type']}`,
    };
  }

  async rollback(target: ActionTarget, preState: StructuredDataPreState): Promise<RollbackResult> {
    liveSchemaRegistry.set(target.targetUrl, preState.previousSchemas);

    return {
      success: true,
      actionId: `rollback-schema-${Date.now()}`,
      restoredState: preState.previousSchemas,
      rolledBackAt: new Date(),
      message: 'Successfully removed injected schema and restored previous state',
    };
  }

  public static getDeployedSchemas(url: string): Record<string, any>[] {
    return liveSchemaRegistry.get(url) || [];
  }
}
