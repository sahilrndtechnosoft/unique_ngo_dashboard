import { Dialog, DialogPanel } from '@headlessui/react';
import type { ReactEventHandler } from 'react';
import { useState } from 'react';

type ZoomableImageProps = {
    src: string;
    alt?: string;
    className?: string;
    buttonClassName?: string;
    onError?: ReactEventHandler<HTMLImageElement>;
};

export default function ZoomableImage({ src, alt = '', className = '', buttonClassName = '', onError }: ZoomableImageProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" className={`inline-block cursor-zoom-in ${buttonClassName}`} onClick={() => setOpen(true)}>
                <img src={src} alt={alt} className={className} loading="lazy" onError={onError} />
            </button>

            <Dialog open={open} onClose={setOpen} className="fixed inset-0 z-[100]">
                <div className="fixed inset-0 bg-black/80" aria-hidden="true" />
                <DialogPanel className="fixed inset-0 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xl leading-none text-black shadow"
                        aria-label="Close image preview"
                        onClick={() => setOpen(false)}
                    >
                        ×
                    </button>
                    <img src={src} alt={alt} className="max-h-[92vh] max-w-[92vw] rounded bg-white object-contain shadow-2xl" />
                </DialogPanel>
            </Dialog>
        </>
    );
}
