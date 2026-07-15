import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IconHorizontalDots from '../Icon/IconHorizontalDots';

export interface RowAction {
    label: string;
    onClick: () => void;
    danger?: boolean;
    hidden?: boolean;
}

interface RowActionsMenuProps {
    actions: RowAction[];
}

export function RowActionsMenu({ actions }: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const visible = actions.filter((action) => !action.hidden);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            setOpen(false);
        };

        const onScroll = () => setOpen(false);

        document.addEventListener('mousedown', onPointerDown);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open]);

    if (!visible.length) return null;

    const toggle = () => {
        const button = buttonRef.current;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const menuWidth = 160;
        const menuHeight = visible.length * 40 + 16;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < menuHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6;
        const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
        setPosition({ top, left });
        setOpen((prev) => !prev);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className="btn btn-sm btn-outline-primary p-1.5"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <IconHorizontalDots className="w-5 h-5 opacity-80" />
            </button>
            {open
                ? createPortal(
                      <ul
                          ref={menuRef}
                          role="menu"
                          className="fixed z-[9999] min-w-[160px] rounded bg-white dark:bg-[#1b2e4b] py-2 shadow-lg border border-[#e0e6ed] dark:border-[#191e3a] text-black dark:text-white-dark"
                          style={{ top: position.top, left: position.left }}
                      >
                          {visible.map((action) => (
                              <li key={action.label} role="none">
                                  <button
                                      type="button"
                                      role="menuitem"
                                      className={`w-full text-left px-4 py-2 hover:bg-primary/10 hover:text-primary ${
                                          action.danger ? 'text-danger' : ''
                                      }`}
                                      onClick={() => {
                                          setOpen(false);
                                          action.onClick();
                                      }}
                                  >
                                      {action.label}
                                  </button>
                              </li>
                          ))}
                      </ul>,
                      document.body,
                  )
                : null}
        </>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const tone =
        status === 'ACTIVE' || status === 'APPROVED'
            ? 'badge-outline-success'
            : status === 'PENDING' || status === 'PENDING_REVIEW' || status === 'PENDING_VERIFICATION' || status === 'UNDER_REVIEW'
              ? 'badge-outline-warning'
              : status === 'REJECTED' || status === 'SUSPENDED' || status === 'BANNED' || status === 'INACTIVE'
                ? 'badge-outline-danger'
                : 'badge-outline-primary';

    return <span className={`badge ${tone}`}>{status}</span>;
}

export function FormField({
    label,
    required,
    children,
    className = '',
    hint,
}: {
    label: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
    hint?: string;
}) {
    return (
        <div className={className}>
            <label className="mb-1.5 block text-sm font-medium text-white-dark">
                {label}
                {required ? <span className="text-danger"> *</span> : null}
            </label>
            {children}
            {hint ? <p className="mt-1.5 text-xs leading-snug text-white-dark/90">{hint}</p> : null}
        </div>
    );
}

export function FormSection({
    title,
    description,
    children,
    className = '',
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={`space-y-4 ${className}`}>
            <div className="border-b border-[#ebedf2] pb-2 dark:border-[#191e3a]">
                <h6 className="text-sm font-semibold dark:text-white-light">{title}</h6>
                {description ? <p className="mt-1 text-xs text-white-dark">{description}</p> : null}
            </div>
            {children}
        </div>
    );
}
