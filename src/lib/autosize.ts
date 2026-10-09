import { useLayoutEffect, type RefObject } from 'react';

/** Grows a textarea to fit its text, so long content never needs an inner scrollbar. */
export function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const area = ref.current;
    if (!area) return;
    const fit = () => {
      area.style.height = 'auto';
      const borders = area.offsetHeight - area.clientHeight;
      area.style.height = `${area.scrollHeight + borders}px`;
    };
    fit();
    // A narrower window wraps the text onto more lines.
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [ref, value]);
}
