import { StuckExecutionWatchdog, WatchdogConfig, WatchdogEvaluationResult } from '../action/approval/stuckExecutionWatchdog';

export interface ActionWatchdogWorkerRuntime {
  runOnce: (config?: WatchdogConfig) => Promise<WatchdogEvaluationResult>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}

export class ActionWatchdogWorker {
  public static readonly DEFAULT_SCHEDULE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Starts the background watchdog worker on a scheduled interval.
   */
  public static start(intervalMs: number = this.DEFAULT_SCHEDULE_INTERVAL_MS, config?: WatchdogConfig): ActionWatchdogWorkerRuntime {
    let running = true;
    let isExecutingCycle = false;

    console.log(`[action-watchdog-worker] Started autonomous Action Stuck Execution Watchdog (Interval: ${intervalMs / 1000}s)`);

    const executeCycle = async (): Promise<WatchdogEvaluationResult> => {
      if (isExecutingCycle) {
        console.log(`[action-watchdog-worker] Cycle already in progress, skipping overlapping execution.`);
        return { evaluatedCount: 0, stuckCount: 0, incidents: [], resolvedActions: [] };
      }

      isExecutingCycle = true;
      try {
        console.log(`[action-watchdog-worker] Executing scheduled scan for stuck actions...`);
        const result = await StuckExecutionWatchdog.scanAndResolveStuckActions({
          policyMode: 'RISK_BASED',
          ...config,
        });

        if (result.stuckCount > 0) {
          console.warn(
            `[action-watchdog-worker] Detected ${result.stuckCount} stuck actions. Emitted ACTION_STUCK_EXECUTION events.`
          );
        } else {
          console.log(`[action-watchdog-worker] Watchdog scan completed. Zero stuck executions detected.`);
        }

        return result;
      } catch (error) {
        console.error(`[action-watchdog-worker] Error during watchdog execution cycle:`, error);
        throw error;
      } finally {
        isExecutingCycle = false;
      }
    };

    const intervalId = setInterval(async () => {
      if (!running) return;
      try {
        await executeCycle();
      } catch (err) {
        console.error('[action-watchdog-worker] Scheduled execution encountered an error:', err);
      }
    }, intervalMs);

    return {
      runOnce: async (overrideConfig?: WatchdogConfig) => {
        return await executeCycle();
      },
      stop: async () => {
        running = false;
        clearInterval(intervalId);
        console.log(`[action-watchdog-worker] Stopped Action Stuck Execution Watchdog.`);
      },
      isRunning: () => running,
    };
  }
}
