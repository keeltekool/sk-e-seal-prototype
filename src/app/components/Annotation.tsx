'use client';

import { useState, useRef, useEffect } from 'react';

interface AnnotationProps {
  children: React.ReactNode;
  detail?: React.ReactNode;
}

export function Annotation({ children, detail }: AnnotationProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`border-l-2 border-primary/30 pl-4 py-2 my-4 transition-all duration-500 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-primary/50 text-sm mt-0.5 shrink-0">info</span>
        <div className="text-sm text-secondary/80 font-body italic leading-relaxed">
          {children}
          {detail && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-1 text-primary/60 hover:text-primary text-xs font-label uppercase tracking-wider inline-flex items-center gap-0.5"
              >
                {expanded ? 'Less' : 'More'}
                <span className="material-symbols-outlined text-xs">
                  {expanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {expanded && (
                <div className="mt-2 text-secondary/70 not-italic">{detail}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
