import { IActionExecutor } from './actionExecutorInterface';
import { ActionType } from '../actionTypes';
import { CanonicalActionExecutor } from './canonicalActionExecutor';
import { MetaTagsActionExecutor } from './metaTagsActionExecutor';
import { StructuredDataActionExecutor } from './structuredDataActionExecutor';
import { RedirectActionExecutor } from './redirectActionExecutor';
import { InternalLinkActionExecutor } from './internalLinkActionExecutor';
import { ContentRefreshActionExecutor } from './contentRefreshActionExecutor';

export class ActionExecutorRouter {
  private static executors: Map<string, IActionExecutor> = new Map();

  static {
    this.registerExecutor(new CanonicalActionExecutor());
    this.registerExecutor(new MetaTagsActionExecutor());
    this.registerExecutor(new StructuredDataActionExecutor());
    this.registerExecutor(new RedirectActionExecutor());
    this.registerExecutor(new InternalLinkActionExecutor());
    this.registerExecutor(new ContentRefreshActionExecutor());
  }

  public static registerExecutor(executor: IActionExecutor): void {
    this.executors.set(executor.actionType, executor);
  }

  public static getExecutor(actionType: string): IActionExecutor {
    const executor = this.executors.get(actionType);
    if (!executor) {
      throw new Error(`No action executor registered for action type: '${actionType}'`);
    }
    return executor;
  }

  public static hasExecutor(actionType: string): boolean {
    return this.executors.has(actionType);
  }
}
