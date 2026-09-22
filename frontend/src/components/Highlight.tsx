import 'highlight.js/styles/monokai-sublime.css';
import hightlight from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import { PropsWithChildren, useEffect, useRef } from 'react';

hightlight.registerLanguage('typescript', typescript);
hightlight.registerLanguage('xml', xml);

const CodeHighlight = ({ children }: PropsWithChildren) => {
    const highlightElement = useRef<any>(null);

    useEffect(() => {
        if (highlightElement?.current) {
            hightlight.highlightElement(highlightElement.current.querySelector('pre'));
        }
    }, []);

    return (
        <div ref={highlightElement} className="highlight-el">
            {children}
        </div>
    );
};

export default CodeHighlight;
