import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { loadActiveBusinessGoals, saveNewBusinessGoal, completeBusinessGoal, archiveBusinessGoal, REVENUE_GOAL_WARNING } from '../../aiCeo/businessGoals';
import { BUSINESS_GOAL_TYPE_VALUES, type BusinessGoal, type BusinessGoalType } from '../../aiCeo/domain/types';

// Build 030 Part 2, Module 5 — Business Goals panel. Basic CRUD: create a
// goal, mark it complete, or archive it. The revenue-goal honesty warning
// (Core Principle) is shown the moment the title/notes text is detected as
// revenue-worded — never silently converted into a required image count.

const GOAL_TYPE_LABEL: Record<BusinessGoalType, string> = {
  GROW_PORTFOLIO: 'Grow Portfolio',
  IMPROVE_DIVERSITY: 'Improve Portfolio Diversity',
  COMPLETE_COLLECTIONS: 'Complete Existing Collections',
  PREPARE_MORE_FOR_SUBMISSION: 'Prepare More Items for Submission',
  INCREASE_ADOBE_COVERAGE: 'Increase Adobe Stock Coverage',
  INCREASE_SHUTTERSTOCK_COVERAGE: 'Increase Shutterstock Coverage',
  INCREASE_ETSY_COVERAGE: 'Increase Etsy Coverage',
  PRODUCE_EVERGREEN: 'Produce Evergreen Content',
  PRODUCE_SEASONAL: 'Produce Seasonal Content',
  REDUCE_REJECTION_RATE: 'Reduce Rejection Rate',
  CUSTOM: 'Custom Goal',
};

export function GoalsPanel() {
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<BusinessGoalType>('GROW_PORTFOLIO');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [showRevenueWarning, setShowRevenueWarning] = useState(false);

  const reload = useCallback(async () => {
    try {
      setGoals(await loadActiveBusinessGoals());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      const goal = await saveNewBusinessGoal({
        type,
        title: title.trim(),
        targetQuantity: targetQuantity ? Number(targetQuantity) : null,
        notes: notes.trim(),
      });
      if (goal.revenueGoalDetected) setShowRevenueWarning(true);
      setTitle('');
      setTargetQuantity('');
      setNotes('');
      await reload();
    },
    [title, type, targetQuantity, notes, reload],
  );

  const handleComplete = useCallback(
    async (id: string) => {
      await completeBusinessGoal(id);
      await reload();
    },
    [reload],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      await archiveBusinessGoal(id);
      await reload();
    },
    [reload],
  );

  return (
    <section className="aiceo-goals">
      <h3>Business Goals</h3>
      {error && (
        <p role="alert" className="aiceo-error">
          Could not load Goals: {error}
        </p>
      )}
      <ul className="aiceo-goal-list">
        {goals.length === 0 && <li className="aiceo-goal-empty">No active goals yet.</li>}
        {goals.map((goal) => (
          <li key={goal.id} className="aiceo-goal-item">
            <span className="aiceo-goal-title">{goal.title}</span>
            <span className="aiceo-goal-type">{GOAL_TYPE_LABEL[goal.type]}</span>
            {goal.targetQuantity !== null && <span className="aiceo-goal-target">Target: {goal.targetQuantity}</span>}
            {goal.revenueGoalDetected && <p className="aiceo-goal-warning">{REVENUE_GOAL_WARNING}</p>}
            <div className="aiceo-goal-actions">
              <button type="button" className="btn" onClick={() => handleComplete(goal.id)}>
                Mark Complete
              </button>
              <button type="button" className="btn" onClick={() => handleArchive(goal.id)}>
                Archive
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="aiceo-goal-form" onSubmit={handleSubmit}>
        <h4>Add a Goal</h4>
        <label htmlFor="aiceo-goal-title">Title</label>
        <input id="aiceo-goal-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grow the portfolio to 200 patterns" />

        <label htmlFor="aiceo-goal-type">Goal type</label>
        <select id="aiceo-goal-type" value={type} onChange={(e) => setType(e.target.value as BusinessGoalType)}>
          {BUSINESS_GOAL_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {GOAL_TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        <label htmlFor="aiceo-goal-quantity">Target quantity (optional)</label>
        <input id="aiceo-goal-quantity" type="number" min={0} value={targetQuantity} onChange={(e) => setTargetQuantity(e.target.value)} />

        <label htmlFor="aiceo-goal-notes">Notes (optional)</label>
        <textarea id="aiceo-goal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <button type="submit" className="btn btn--primary">
          Add Goal
        </button>
      </form>

      {showRevenueWarning && (
        <p role="alert" className="aiceo-goal-warning">
          {REVENUE_GOAL_WARNING}
        </p>
      )}
    </section>
  );
}
