import React from "react";

export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [state, setState] = React.useState(value);

  React.useEffect(() => {
    const id = window.setTimeout(() => setState(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return state;
}


