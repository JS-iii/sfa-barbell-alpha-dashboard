/**
 * Operator Approval Checklist v7B.0.1
 *
 * The checklist that an operator must complete before v7B.1 canary
 * writes are authorized. This checklist is documentation-only in
 * v7B.0.1 — it cannot itself authorize anything.
 */

export interface OperatorApprovalChecklist {
  /** Checklist version */
  schemaVersion: "open-brain-operator-checklist-v7b01";

  /** Whether this checklist itself is complete */
  isComplete: boolean;

  /** Items */
  items: ChecklistItem[];

  /** Safety */
  safety: {
    notExecutionAuthority: true;
    isGovernedState: false;
    networkWriteStatus: "dry-run-local-only";
    canAuthorizeV7B: false; // KEY: this checklist cannot authorize
  };
}

export interface ChecklistItem {
  id: string;
  description: string;
  required: boolean;
  completed: boolean;
}

/**
 * The mandatory operator checklist items.
 */
export const MANDATORY_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "v7b0-sealed",
    description: "v7B.0 is sealed and accepted",
    required: true,
    completed: false,
  },
  {
    id: "all-tests-pass",
    description: "All bridge test suites pass (163/163 or current total)",
    required: true,
    completed: false,
  },
  {
    id: "kill-switch-closed",
    description: "Kill switch is fail-closed (OPENBRAIN_WRITE_DISABLED not 'false' without auth)",
    required: true,
    completed: false,
  },
  {
    id: "canary-payload-valid",
    description: "Canary payload has been validated by canaryValidator",
    required: true,
    completed: false,
  },
  {
    id: "rollback-ready",
    description: "Rollback checklist reviewed and emergency contacts set",
    required: true,
    completed: false,
  },
  {
    id: "audit-contract-reviewed",
    description: "First-write audit event contract reviewed",
    required: true,
    completed: false,
  },
  {
    id: "no-credentials-in-code",
    description: "No credential values in source code (verified by security scan)",
    required: true,
    completed: false,
  },
  {
    id: "credentials-staged-env-only",
    description: "Credentials staged in environment variables only (future phase)",
    required: false,
    completed: false,
  },
  {
    id: "security-review",
    description: "Security review completed (future phase)",
    required: false,
    completed: false,
  },
  {
    id: "open-brain-endpoint-reachable",
    description: "Open Brain endpoint confirmed reachable (future phase)",
    required: false,
    completed: false,
  },
];

/**
 * Create a fresh operator checklist.
 */
export function createOperatorChecklist(): OperatorApprovalChecklist {
  return {
    schemaVersion: "open-brain-operator-checklist-v7b01",
    isComplete: false,
    items: MANDATORY_CHECKLIST_ITEMS.map((item) => ({ ...item })),
    safety: {
      notExecutionAuthority: true,
      isGovernedState: false,
      networkWriteStatus: "dry-run-local-only",
      canAuthorizeV7B: false,
    },
  };
}

/**
 * Check if all required items are complete.
 */
export function isChecklistComplete(
  checklist: OperatorApprovalChecklist
): boolean {
  return checklist.items
    .filter((item) => item.required)
    .every((item) => item.completed);
}

/**
 * Mark a checklist item as complete.
 */
export function completeChecklistItem(
  checklist: OperatorApprovalChecklist,
  itemId: string
): void {
  const item = checklist.items.find((i) => i.id === itemId);
  if (item) {
    item.completed = true;
    checklist.isComplete = isChecklistComplete(checklist);
  }
}

/**
 * Check if this checklist can authorize v7B.
 *
 * v7B.0.1: ALWAYS false. The checklist documents readiness but
 * cannot itself grant authorization.
 */
export function canChecklistAuthorizeV7B(): boolean {
  return false;
}
