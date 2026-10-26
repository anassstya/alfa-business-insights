import { useId, useMemo, type PropsWithChildren, type ReactNode } from "react";
import { GroupHint, GroupItems, GroupRoot, GroupTitle, type RadioSize } from "./Radio.styled";
import { RadioGroupContext } from "./RadioGroupContext";

interface RadioGroupProps extends PropsWithChildren {
  value: string | null;
  onChange(value: string): void;
  name?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  direction?: 'vertical' | 'horizontal';
  size?: RadioSize;
  disabled?: boolean;
  className?: string;
}

const RadioGroup = ({
  value,
  onChange,
  name,
  label,
  hint,
  error,
  direction = 'vertical',
  size = 's',
  disabled,
  className,
  children,
}: RadioGroupProps) => {
  const generatedName = useId();
  const hasError = Boolean(error);

  const context = useMemo(() => ({
    name: name ?? generatedName,
    value,
    onChange,
    size,
    disabled,
    error: hasError,
  }), [name, generatedName, value, onChange, size, disabled, hasError]);

  return (
    <GroupRoot className={className} disabled={disabled} role="radiogroup" aria-invalid={hasError || undefined}>
      {label && <GroupTitle>{label}</GroupTitle>}
      <RadioGroupContext.Provider value={context}>
        <GroupItems $direction={direction}>{children}</GroupItems>
      </RadioGroupContext.Provider>
      {(error || hint) && <GroupHint $error={hasError}>{error || hint}</GroupHint>}
    </GroupRoot>
  )
}

export { RadioGroup, type RadioGroupProps };
