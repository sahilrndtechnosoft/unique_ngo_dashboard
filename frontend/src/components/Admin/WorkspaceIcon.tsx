import { SVGProps } from 'react';
const paths: Record<string, string> = {
 overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 box: 'M21 8l-9 5-9-5 M12 13v9 M3 7l9-5 9 5v10l-9 5-9-5z M7.5 4.5l9 5',
 heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
 calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
 message: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z',
 search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 arrow: 'M5 12h14 M12 5l7 7-7 7',
 chevron: 'M9 5l7 7-7 7',
 plus: 'M12 5v14 M5 12h14',
 close: 'M6 6l12 12 M6 18L18 6',
 panel: 'M9 3v18 M3 3h18v18H3z',
 bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
 help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 flag: 'M4 22V3 M4 4c5-5 10 5 16 0v12c-6 5-11-5-16 0',
 hospital: 'M8 3h8v18H8z M8 8H3v13h18V8h-5 M10 7h4 M12 5v4 M11 17h2v4',
 drop: 'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z',
 tag: 'M20 13l-7 7a2 2 0 0 1-3 0l-8-8V2h10l8 8a2 2 0 0 1 0 3 M7 7h.01',
 filter: 'M4 7h16 M7 12h10 M10 17h4',
 download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
 settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
};
export default function WorkspaceIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.box} /></svg>;
}
