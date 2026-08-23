import { ActionType, ActionTarget, ValidationResult, ExecutionResult, RollbackResult } from '../actionTypes';

export interface IActionExecutor<TPayload = any, TPreState = any> {
  readonly actionType: ActionType;

  /**
   * Validates the payload and pre-conditions before executing.
   */
  validate(target: ActionTarget, payload: TPayload): Promise<ValidationResult>;

  /**
   * Captures the exact pre-state snapshot of the target for 100% reversible rollbacks.
   */
  capturePreState(target: ActionTarget): Promise<TPreState>;

  /**
   * Executes the atomic modification.
   */
  apply(target: ActionTarget, payload: TPayload, preState: TPreState): Promise<ExecutionResult>;

  /**
   * Rolls back the modification by restoring the pre-state.
   */
  rollback(target: ActionTarget, preState: TPreState): Promise<RollbackResult>;
}
