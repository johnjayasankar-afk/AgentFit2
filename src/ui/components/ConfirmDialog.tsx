import { useEffect, useRef } from "react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );
  const destructive = /delete/i.test(confirmLabel);

  useEffect(() => {
    (destructive ? cancelRef : confirmRef).current?.focus();
  }, [destructive]);

  const cancel = () => {
    const target = returnFocus.current;
    onCancel();
    queueMicrotask(() => target?.focus?.());
  };

  const confirm = () => {
    const target = returnFocus.current;
    onConfirm();
    queueMicrotask(() => target?.focus?.());
  };

  return (
    <div
      className="modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onClick={cancel}
    >
      <div
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            cancel();
          }
          if (event.key === "Tab") {
            event.preventDefault();
            const current = document.activeElement;
            if (current === confirmRef.current) cancelRef.current?.focus();
            else confirmRef.current?.focus();
          }
        }}
      >
        <p className="sys">Confirm</p>
        <h2 id="confirm-title" className="fit-heading" style={{ marginTop: 8 }}>
          {title}
        </h2>
        <p className="lede" style={{ marginTop: 12 }} id="confirm-body">
          {body}
        </p>
        <div className="toolbar">
          <button ref={confirmRef} type="button" className="ink-btn" onClick={confirm}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} type="button" className="line-btn" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
