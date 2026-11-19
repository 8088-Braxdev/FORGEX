const toastIds: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function registerToast(id: string): () => void {
  if (!toastIds.includes(id)) toastIds.push(id);
  notify();

  return () => {
    const index = toastIds.indexOf(id);
    if (index >= 0) toastIds.splice(index, 1);
    notify();
  };
}

export function getToastStackIndex(id: string): number {
  const index = toastIds.indexOf(id);
  return index >= 0 ? index : 0;
}

export function subscribeToastStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}