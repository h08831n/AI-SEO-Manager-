import { IActionExecutor } from './actionExecutorInterface';
import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';
import { CmsProviderRegistry } from '../cms/cmsProviderRegistry';

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

export class InternalLinkActionExecutor implements IActionExecutor<InternalLinkPayload, InternalLinkPreState> {
  readonly actionType: ActionType = 'INJECT_INTERNAL_LINK';

  async validate(target: ActionTarget, payload: InternalLinkPayload): Promise<ValidationResult> {
    if (!payload.targetUrl || !payload.anchorText) {
      return { valid: false, errors: ['targetUrl and anchorText are required'] };
    }
    return { valid: true };
  }

  async capturePreState(target: ActionTarget): Promise<InternalLinkPreState> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const existing = await cms.getInternalLinks(target.targetUrl);
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
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.injectInternalLink(target.targetUrl, payload.targetUrl, payload.anchorText);

    return {
      success: cmsRes.success,
      actionId: `exec-link-${Date.now()}`,
      appliedState: { injectedLink: payload },
      preStateSnapshot: preState,
      executedAt: new Date(),
      message: cmsRes.message || `Injected internal link to ${payload.targetUrl} with anchor "${payload.anchorText}"`,
      diffSummary: `+ Link: [${payload.anchorText}](${payload.targetUrl}) on ${target.targetUrl} [${cms.platform}]`,
    };
  }

  async rollback(target: ActionTarget, preState: InternalLinkPreState): Promise<RollbackResult> {
    const cms = CmsProviderRegistry.getProvider(target.platform);
    const cmsRes = await cms.revertInternalLinks(target.targetUrl, preState.links);

    return {
      success: cmsRes.success,
      actionId: `rollback-link-${Date.now()}`,
      restoredState: preState,
      rolledBackAt: new Date(),
      message: cmsRes.message || `Removed injected internal links and restored pre-state on ${target.targetUrl}`,
    };
  }

  public static getDeployedLinks(url: string, platform?: string) {
    const cms = CmsProviderRegistry.getProvider(platform);
    return (cms as any).deployedLinks?.get(url) || [];
  }
}
