import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

const Dropdown = (props : any, forwardedRef: any) => {
    const [visibility, setVisibility] = useState<any>(false);
    const popperId = useId();

    const referenceRef = useRef<any>();
    const popperRef = useRef<any>();

    const { styles, attributes } = usePopper(referenceRef.current, popperRef.current, {
        placement: props.placement || 'bottom-end',
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: props.offset || [(0)],
                },
            },
        ],
    });

    const handleDocumentClick = (event: any) => {
        if (referenceRef.current?.contains(event.target) || popperRef.current?.contains(event.target)) {
            return;
        }

        setVisibility(false);
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleDocumentClick);
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    useImperativeHandle(forwardedRef, () => ({
        close() {
            setVisibility(false);
        },
    }));

    return (
        <>
            <button
                ref={referenceRef}
                type="button"
                className={props.btnClassName}
                aria-expanded={visibility}
                aria-controls={popperId}
                onClick={() => setVisibility(!visibility)}
            >
                {props.button}
            </button>

                <div
                ref={popperRef}
                style={styles.popper}
                {...attributes.popper}
                id={popperId}
                className="z-50"
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && visibility) {
                        event.preventDefault();
                        setVisibility(false);
                        referenceRef.current?.focus();
                    }
                }}
                onClick={() => setVisibility(!visibility)}
                >
                    {visibility && props.children}
                </div>

        </>
    );
};

export default forwardRef(Dropdown);
