import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';
import { CmsProviderRegistry } from '../cms/cmsProviderRegistry';

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
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const existing = await cms.getStructuredData(target.targetUrl);
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
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.injectStructuredData(target.targetUrl, payload.schemaJsonLd);

    return {
      success: cmsRes.success,
      actionId: `exec-schema-${Date.now()}`,
      appliedState: { injectedSchema: payload.schemaJsonLd },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: cmsRes.message || `Successfully injected ${payload.schemaType} structured data`,
      diffSummary: `Injected schema @type: ${payload.schemaJsonLd['@type']} [${cms.platform}]`,
    };
  }

  async rollback(target: ActionTarget, preState: StructuredDataPreState): Promise<RollbackResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.revertStructuredData(target.targetUrl, preState.previousSchemas);

    return {
      success: cmsRes.success,
      actionId: `rollback-schema-${Date.now()}`,
      restoredState: preState.previousSchemas,
      rolledBackAt: new Date(),
      message: cmsRes.message || 'Successfully removed injected schema and restored previous state',
    };
  }

  public static getDeployedSchemas(url: string, platform?: string): Record<string, any>[] {
    const cms = CmsProviderRegistry.getProvider(platform);
    return (cms as any).deployedSchemas?.get(url) || [];
  }
}
