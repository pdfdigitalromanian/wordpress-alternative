import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="cms-dialog" onClose={onClose} aria-label={title}><div className="section-heading"><h2>{title}</h2><button type="button" className="btn-secondary" onClick={() => ref.current?.close()} aria-label="Close dialog">×</button></div>{children}</dialog>;
}
