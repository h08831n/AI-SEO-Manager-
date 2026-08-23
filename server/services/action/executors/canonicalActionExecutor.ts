import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

export interface CanonicalPayload {
  targetUrl: string;
  canonicalUrl: string;
}

export interface CanonicalPreState {
  targetUrl: string;
  previousCanonicalUrl: string | null;
  capturedAt: string;
}

// In-memory deployed state registry for simulation/sandboxing
const liveCanonicalRegistry: Map<string, string> = new Map();

export class CanonicalActionExecutor implements IActionExecutor<CanonicalPayload, CanonicalPreState> {
  readonly actionType: ActionType = 'SET_CANONICAL_URL';

  async validate(target: ActionTarget, payload: CanonicalPayload): Promise<ValidationResult> {
    if (!payload.canonicalUrl) {
      return { valid: false, errors: ['canonicalUrl is required in payload'] };
    }
    try {
      new URL(payload.canonicalUrl);
    } catch {
      return { valid: false, errors: ['canonicalUrl must be a valid RFC-compliant URL'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<CanonicalPreState> {
    const existing = liveCanonicalRegistry.get(target.targetUrl) || null;
    return {
      targetUrl: target.targetUrl,
      previousCanonicalUrl: existing,
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: CanonicalPayload,
    preState: CanonicalPreState
  ): Promise<ExecutionResult> {
    liveCanonicalRegistry.set(target.targetUrl, payload.canonicalUrl);

    return {
      success: true,
      actionId: `exec-canon-${Date.now()}`,
      appliedState: { canonicalUrl: payload.canonicalUrl },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: `Successfully deployed canonical tag pointing to ${payload.canonicalUrl}`,
      diffSummary: `Canonical: ${preState.previousCanonicalUrl || '<none>'} -> ${payload.canonicalUrl}`,
    };
  }

  async rollback(target: ActionTarget, preState: CanonicalPreState): Promise<RollbackResult> {
    if (preState.previousCanonicalUrl) {
      liveCanonicalRegistry.set(target.targetUrl, preState.previousCanonicalUrl);
    } else {
      liveCanonicalRegistry.delete(target.targetUrl);
    }

    return {
      success: true,
      actionId: `rollback-canon-${Date.now()}`,
      restoredState: { canonicalUrl: preState.previousCanonicalUrl },
      rolledBackAt: new Date(),
      message: `Successfully reverted canonical tag to ${preState.previousCanonicalUrl || '<none>'}`,
    };
  }

  public static getDeployedCanonical(url: string): string | undefined {
    return liveCanonicalRegistry.get(url);
  }
}
