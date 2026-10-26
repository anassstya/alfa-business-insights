import { useCallback, useEffect, useRef } from "react"

/**
 * Откладывает вызов callback до паузы в `delay` мс: каждый новый вызов перезапускает таймер.
 * `flush` вызывает отложенное немедленно (например, по blur или Enter), `cancel` — отменяет.
 * При размонтировании отложенный вызов выполняется, чтобы не терять последнее значение.
 */
const useDebouncedCallback = <TArgs extends unknown[]>(callback: (...args: TArgs) => void, delay: number) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingArgsRef = useRef<TArgs | null>(null);

  // всегда вызываем свежий callback, не пересоздавая debounced-функцию
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback])

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingArgsRef.current = null;
  }, [])

  const flush = useCallback(() => {
    const args = pendingArgsRef.current;
    if (!args) return;

    cancel();
    callbackRef.current(...args);
  }, [cancel])

  const run = useCallback((...args: TArgs) => {
    pendingArgsRef.current = args;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delay);
  }, [delay, flush])

  useEffect(() => flush, [flush])

  return { run, flush, cancel };
}

export { useDebouncedCallback };
