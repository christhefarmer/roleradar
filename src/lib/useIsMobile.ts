import { useEffect, useMemo, useState } from 'react';

/** True when the viewport is at or below the mobile breakpoint (≤820px) —
 *  the same breakpoint the CSS shell collapse uses. */
export function useIsMobile(): boolean {
  const query = useMemo(() => window.matchMedia('(max-width: 820px)'), []);
  const [mobile, setMobile] = useState(query.matches);
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  return mobile;
}
