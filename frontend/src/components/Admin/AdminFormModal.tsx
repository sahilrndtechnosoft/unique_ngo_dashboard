import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import IconX from '../Icon/IconX';

interface AdminFormModalProps {
    open: boolean;
    title: string;
    onClose: () => void;
    onSubmit?: (event: FormEvent) => void;
    children: ReactNode;
    /** Content rendered below the form grid (e.g. related lists). */
    extra?: ReactNode;
    footer?: ReactNode;
    submitLabel?: string;
    readOnly?: boolean;
    size?: 'md' | 'lg' | 'xl';
    busy?: boolean;
}

const sizeClass = {
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
};

export default function AdminFormModal({
    open,
    title,
    onClose,
    onSubmit,
    children,
    extra,
    footer,
    submitLabel = 'Save',
    readOnly = false,
    size = 'lg',
    busy = false,
}: AdminFormModalProps) {
    const [dirty, setDirty] = useState(false);
    const [discard, setDiscard] = useState(false);
    const submitting = useRef(false);
    useEffect(() => { if (open) {setDirty(false); setDiscard(false); submitting.current = false;} }, [open]);
    useEffect(() => { if (!busy) submitting.current = false; }, [busy]);
    useEffect(() => {
        if (!open || !dirty) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [open, dirty]);
    const requestClose = () => { if (busy || submitting.current) return; if (dirty && !readOnly) setDiscard(true); else onClose(); };
    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" open={open} onClose={requestClose} className="relative z-[60]">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[#28212c]/40 backdrop-blur-sm" />
                </TransitionChild>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-stretch justify-end">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 translate-x-8"
                            enterTo="opacity-100 translate-x-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-x-0"
                            leaveTo="opacity-0 translate-x-8"
                        >
                            <DialogPanel
                                className={`admin-form-modal panel border-0 p-0 rounded-t-xl sm:rounded-lg overflow-hidden w-full ${sizeClass[size]} text-black dark:text-white-dark flex flex-col max-h-[min(92vh,880px)]`}
                            >
                                <button
                                    type="button"
                                    onClick={requestClose}
                                    aria-label="Close dialog"
                                    title="Close dialog"
                                    className="absolute top-2 ltr:right-2 rtl:left-2 z-10 grid h-10 w-10 place-items-center rounded text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                                >
                                    <IconX />
                                </button>
                                <DialogTitle as="h2" className="admin-form-modal-header shrink-0 text-lg font-medium ltr:pl-5 rtl:pr-5 py-3.5 ltr:pr-[50px] rtl:pl-[50px] border-b">
                                    {title}
                                </DialogTitle>
                                {discard && <div className="ws-discard" role="alert"><span>You have unsaved changes.</span><button type="button" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={onClose}>Discard</button></div>}
                                <form
                                    className="flex min-h-0 flex-1 flex-col"
                                    onChange={() => { setDirty(true); setDiscard(false); }}
                                    onSubmit={(event) => {
                                        if (busy || submitting.current || readOnly || !onSubmit) {
                                            event.preventDefault();
                                            return;
                                        }
                                        submitting.current = true;
                                        onSubmit(event);
                                        queueMicrotask(() => { submitting.current = false; });
                                    }}
                                >
                                    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">{children}</div>
                                        {extra}
                                    </div>
                                    {footer !== undefined ? (
                                        footer
                                    ) : (
                                        <div className="admin-form-modal-footer shrink-0 flex justify-end items-center gap-3 border-t px-5 py-3.5 sm:px-6"><span className="ws-form-state" role="status">{busy ? 'Saving your changes…' : dirty ? 'Unsaved changes' : readOnly ? 'Record details' : 'Ready to edit'}</span>
                                            <button type="button" className="btn btn-outline-danger" onClick={requestClose}>
                                                {readOnly ? 'Close' : 'Cancel'}
                                            </button>
                                            {!readOnly && onSubmit ? (
                                                <button type="submit" className="btn btn-primary" disabled={busy}>
                                                    {busy ? 'Saving...' : submitLabel}
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                </form>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
