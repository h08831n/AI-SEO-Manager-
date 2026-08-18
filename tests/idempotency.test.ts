import { describe, it, expect } from 'vitest';
import { TaskRepository } from '../server/repositories/taskRepository';

describe('TaskRepository Idempotency & Action Boundaries', () => {
  it('executes task in simulation mode idempotently', async () => {
    const idempotencyKey = `test-key-${Date.now()}`;
    const result1 = await TaskRepository.executeTaskWithIdempotency(
      'task-title-opt-01',
      'site-techscale-prod',
      idempotencyKey,
      true // isSimulation
    );

    expect(result1.success).toBe(true);
    expect(result1.status).toBe('SIMULATION_ONLY');
    expect(result1.duplicate).toBeUndefined();

    // Re-executing with the same idempotency key must not perform duplicate execution
    const result2 = await TaskRepository.executeTaskWithIdempotency(
      'task-title-opt-01',
      'site-techscale-prod',
      idempotencyKey,
      true
    );

    expect(result2.success).toBe(true);
    expect(result2.duplicate).toBe(true);
    expect(result2.message).toContain('Duplicate idempotent execution');
  });

  it('blocks live site mutation when integration is not connected', async () => {
    const idempotencyKey = `test-live-key-${Date.now()}`;
    const result = await TaskRepository.executeTaskWithIdempotency(
      'task-title-opt-01',
      'site-techscale-prod',
      idempotencyKey,
      false // live attempt
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('BLOCKED_NO_INTEGRATION');
    expect(result.message).toContain('integration is not connected');
  });
});
