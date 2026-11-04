export function createScheduler(
  render,
  request = requestAnimationFrame,
  cancel = cancelAnimationFrame,
) {
  let ticket = 0,
    reasons = new Set();
  return {
    schedule(reason = "state") {
      reasons.add(reason);
      if (ticket) return;
      ticket = request(() => {
        ticket = 0;
        const pending = [...reasons];
        reasons.clear();
        render(pending);
      });
    },
    cancel() {
      if (ticket) cancel(ticket);
      ticket = 0;
      reasons.clear();
    },
  };
}
