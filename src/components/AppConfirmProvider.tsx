
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useAppConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error(
      "useAppConfirm requires AppConfirmProvider."
    );
  }

  return context;
}

export function AppConfirmProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState<PendingConfirm | null>(null);

  const current = useRef<PendingConfirm | null>(null);
  const queue = useRef<PendingConfirm[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      const item: PendingConfirm = { options, resolve };

      if (current.current) {
        queue.current.push(item);
      } else {
        current.current = item;
        setActive(item);
      }
    });
  }, []);

  const respond = useCallback((accepted: boolean) => {
    const pending = current.current;
    if (!pending) return;

    const next = queue.current.shift() ?? null;
    current.current = next;
    setActive(next);

    pending.resolve(accepted);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (active) {
      if (!dialog.open) dialog.showModal();
      cancelRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [active]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <dialog
        ref={dialogRef}
        className="fx-confirm-dialog"
        aria-labelledby="fx-confirm-title"
        aria-describedby="fx-confirm-message"
        onCancel={(event) => {
          event.preventDefault();
          respond(false);
        }}
      >
        {active && (
          <div className="fx-confirm-content">
            <div className="fx-confirm-heading">
              <span className="fx-confirm-symbol">
                {active.options.destructive ? (
                  <AlertTriangle size={21} />
                ) : (
                  <ShieldCheck size={21} />
                )}
              </span>

              <button
                type="button"
                className="fx-confirm-close"
                aria-label="Close confirmation"
                onClick={() => respond(false)}
              >
                <X size={19} />
              </button>
            </div>

            <h2 id="fx-confirm-title">
              {active.options.title}
            </h2>

            <p id="fx-confirm-message">
              {active.options.message}
            </p>

            <div className="fx-confirm-actions">
              <button
                ref={cancelRef}
                type="button"
                className="fx-confirm-cancel"
                onClick={() => respond(false)}
              >
                {active.options.cancelText ?? "Cancel"}
              </button>

              <button
                type="button"
                className={
                  active.options.destructive
                    ? "fx-confirm-accept danger"
                    : "fx-confirm-accept"
                }
                onClick={() => respond(true)}
              >
                {active.options.confirmText ?? "Continue"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
