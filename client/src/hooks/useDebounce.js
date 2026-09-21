import { useEffect, useState } from 'react';

// Why: prevents a request on every keystroke (PRD performance requirement).
// Returns the value only after `delay` ms without changes.
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
