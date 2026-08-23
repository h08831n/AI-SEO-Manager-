import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

export interface InternalLinkPayload {
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  contextSnippet?: string;
}

export interface InternalLinkPreState {
  sourceUrl: string;
  links: Array<{ targetUrl: string; anchorText: string }>;
  capturedAt: string;
}

const liveLinksRegistry: Map<string, Array<{ targetUrl: string; anchorText: string }>> = new Map();

export class InternalLinkActionExecutor implements IActionExecutor<InternalLinkPayload, InternalLinkPreState> {
  readonly actionType: ActionType = 'INJECT_INTERNAL_LINK';

  async validate(target: ActionTarget, payload: InternalLinkPayload): Promise<ValidationResult> {
    if (!payload.targetUrl || !payload.anchorText) {
      return { valid: false, errors: ['targetUrl and anchorText are required'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<InternalLinkPreState> {
    const existing = liveLinksRegistry.get(target.targetUrl) || [];
    return {
      sourceUrl: target.targetUrl,
      links: [...existing],
      capturedAt: new Date().toISOString(),
    };
  }

  async apply(
    target: ActionTarget,
    payload: InternalLinkPayload,
    preState: InternalLinkPreState
  ): Promise<ExecutionResult> {
    const links = liveLinksRegistry.get(target.targetUrl) || [];
    links.push({ targetUrl: payload.targetUrl, anchorText: payload.anchorText });
    liveLinksRegistry.set(target.targetUrl, links);

    return {
      success: true,
      actionId: `exec-link-${Date.now()}`,
      appliedState: { injectedLink: payload },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: `Injected internal link to ${payload.targetUrl} with anchor "${payload.anchorText}"`,
      diffSummary: `+ Link: [${payload.anchorText}](${payload.targetUrl}) on ${target.targetUrl}`,
    };
  }

  async rollback(target: ActionTarget, preState: InternalLinkPreState): Promise<RollbackResult> {
    liveLinksRegistry.set(target.targetUrl, preState.links);

    return {
      success: true,
      actionId: `rollback-link-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: `Removed injected internal links and restored pre-state on ${target.targetUrl}`,
    };
  }

  public static getDeployedLinks(url: string) {
    return liveLinksRegistry.get(url) || [];
  }
}
