export type TicketSubmissionGuard = {
  begin(): string | null;
  finish(success: boolean): void;
  currentKey(): string | null;
};

export function createTicketSubmissionGuard(
  createKey: () => string = () => crypto.randomUUID(),
): TicketSubmissionGuard {
  let locked = false;
  let idempotencyKey: string | null = null;

  return {
    begin() {
      if (locked) return null;
      locked = true;
      idempotencyKey ||= createKey();
      return idempotencyKey;
    },
    finish(success) {
      locked = false;
      if (success) idempotencyKey = null;
    },
    currentKey() {
      return idempotencyKey;
    },
  };
}
