import { KeyboardEvent, ReactNode, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import IconHorizontalDots from '../Icon/IconHorizontalDots';

export function DetailFacts({ items }: { items: { label: string; value: ReactNode }[] }) {
    return (
        <dl className="admin-detail-facts">
            {items.map((item) => (
                <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

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
    const menuId = useId();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLUListElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const visible = actions.filter((action) => !action.hidden);

    useEffect(() => {
        if (!open) return;

        menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

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

    const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
        const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
        let nextIndex: number | undefined;

        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            buttonRef.current?.focus();
        } else if (event.key === 'ArrowDown') {
            nextIndex = (currentIndex + 1) % menuItems.length;
        } else if (event.key === 'ArrowUp') {
            nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = menuItems.length - 1;
        }

        if (nextIndex !== undefined && menuItems.length) {
            event.preventDefault();
            menuItems[nextIndex]?.focus();
        }
    };

    if (!visible.length) return null;

    const toggle = () => {
        const button = buttonRef.current;
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const menuWidth = 160;
        const menuHeight = visible.length * 40 + 16;
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < menuHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6;
        const isRtl = document.documentElement.dir === 'rtl';
        const alignedLeft = isRtl ? rect.left : rect.right - menuWidth;
        const left = Math.max(8, Math.min(alignedLeft, window.innerWidth - menuWidth - 8));
        setPosition({ top, left });
        setOpen((prev) => !prev);
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className="row-actions-trigger"
                onClick={toggle}
                id={`${menuId}-trigger`}
                aria-label="Row actions"
                title="Row actions"
                aria-haspopup="menu"
                aria-controls={menuId}
                aria-expanded={open}
            >
                <IconHorizontalDots className="w-5 h-5 opacity-80" />
            </button>
            {open
                ? createPortal(
                      <ul
                          ref={menuRef}
                          id={menuId}
                          role="menu"
                          aria-labelledby={`${menuId}-trigger`}
                          onKeyDown={onMenuKeyDown}
                          className="admin-row-action-menu fixed z-[9999] min-w-[160px] bg-white dark:bg-[#151f30] text-black dark:text-white-dark"
                          style={{ top: position.top, left: position.left }}
                      >
                          {visible.map((action) => (
                              <li key={action.label} role="none">
                                  <button
                                      type="button"
                                      role="menuitem"
                                      className={`admin-row-action-item w-full text-left px-4 py-2 hover:bg-primary/10 hover:text-primary ${
                                          action.danger ? 'text-danger' : ''
                                      }`}
                                      onClick={() => {
                                          setOpen(false);
                                          buttonRef.current?.focus();
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
    const normalizedStatus = status.toUpperCase();
    const tone = ['ACTIVE', 'APPROVED', 'COMPLETED', 'DELIVERED', 'FULFILLED', 'PUBLISHED', 'SUCCESS', 'TRANSFERRED', 'VERIFIED'].includes(normalizedStatus)
        ? 'badge-outline-success'
        : ['PENDING', 'PENDING_REVIEW', 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'UNDER_REVIEW', 'PROCESSING', 'OUT_FOR_DELIVERY', 'PARTIALLY_FULFILLED', 'PARTIALLY_REFUNDED', 'OUT_OF_STOCK', 'REQUESTED', 'AVAILABLE', 'PAUSED'].includes(normalizedStatus)
          ? 'badge-outline-warning'
          : ['REJECTED', 'SUSPENDED', 'BANNED', 'INACTIVE', 'CANCELLED', 'REFUNDED', 'FAILED', 'EXPIRED', 'NO_SHOW', 'NEEDS_REPAIR', 'OUT_OF_SERVICE'].includes(normalizedStatus)
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
    const id = useId();
    const hintId = `${id}-hint`;
    const isNativeControl = isValidElement(children)
        && typeof children.type === 'string'
        && ['input', 'select', 'textarea'].includes(children.type);
    const field = isNativeControl
        ? cloneElement(children, {
              id: (children.props as { id?: string }).id ?? id,
              'aria-describedby': [
                  (children.props as { 'aria-describedby'?: string })['aria-describedby'],
                  hint ? hintId : undefined,
              ].filter(Boolean).join(' ') || undefined,
          } as Record<string, unknown>)
        : children;

    return (
        <div className={`admin-form-field ${className}`} role={isNativeControl ? undefined : 'group'} aria-labelledby={isNativeControl ? undefined : `${id}-label`}>
            <label id={`${id}-label`} htmlFor={isNativeControl ? ((children.props as { id?: string }).id ?? id) : undefined} className="mb-1.5 block text-sm font-medium text-white-dark">
                {label}
                {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
            </label>
            {field}
            {hint ? <p id={hintId} className="mt-1.5 text-xs leading-snug text-white-dark/90">{hint}</p> : null}
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
