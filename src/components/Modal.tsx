import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  children: ReactNode;
  variant?: 'center' | 'sheet';
  className?: string;
}

/** Lightweight accessible dialog: focus moves in, Escape closes, focus restored on close. */
export function Modal({ open, onClose, labelledBy, children, variant = 'center', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus], button, input, select, textarea');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
      if (e.key === 'Tab' && el) {
        const items = el.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]');
        if (items.length === 0) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`overlay overlay--${variant}`} onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`dialog dialog--${variant} ${className}`}>
        {children}
      </div>
    </div>
  );
}
