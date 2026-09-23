import { FormEvent, ReactNode } from 'react';
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
    return (
        <Transition appear show={open} as={Fragment}>
            <Dialog as="div" open={open} onClose={onClose} className="relative z-[60]">
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[black]/60" />
                </TransitionChild>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-8">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel
                                className={`admin-form-modal panel border-0 p-0 rounded-t-xl sm:rounded-lg overflow-hidden w-full ${sizeClass[size]} text-black dark:text-white-dark flex flex-col max-h-[min(92vh,880px)]`}
                            >
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close dialog"
                                    title="Close dialog"
                                    className="absolute top-2 ltr:right-2 rtl:left-2 z-10 grid h-10 w-10 place-items-center rounded text-gray-500 hover:bg-black/5 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                                >
                                    <IconX />
                                </button>
                                <DialogTitle as="h2" className="admin-form-modal-header shrink-0 text-lg font-medium ltr:pl-5 rtl:pr-5 py-3.5 ltr:pr-[50px] rtl:pl-[50px] border-b">
                                    {title}
                                </DialogTitle>
                                <form
                                    className="flex min-h-0 flex-1 flex-col"
                                    onSubmit={(event) => {
                                        if (readOnly || !onSubmit) {
                                            event.preventDefault();
                                            return;
                                        }
                                        onSubmit(event);
                                    }}
                                >
                                    <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">{children}</div>
                                        {extra}
                                    </div>
                                    {footer !== undefined ? (
                                        footer
                                    ) : (
                                        <div className="admin-form-modal-footer shrink-0 flex justify-end items-center gap-3 border-t px-5 py-3.5 sm:px-6">
                                            <button type="button" className="btn btn-outline-danger" onClick={onClose}>
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
