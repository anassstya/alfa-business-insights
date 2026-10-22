import type { ComponentProps, ReactNode } from "react";
import { Circle, HiddenInput, Hint, Label, RadioLabel, TextBlock, type RadioSize } from "./Radio.styled";
import { useRadioGroup } from "./RadioGroupContext";

interface RadioProps extends Omit<ComponentProps<'input'>, 'type' | 'size' | 'value'> {
  value?: string;
  label?: ReactNode;
  hint?: ReactNode;
  size?: RadioSize;
  error?: boolean;
  block?: boolean;
  align?: 'start' | 'center';
}

const Radio = ({
  value = '',
  label,
  hint,
  size: sizeProp,
  error: errorProp,
  block,
  align = 'start',
  checked: checkedProp,
  disabled: disabledProp,
  name: nameProp,
  onChange,
  className,
  ...props
}: RadioProps) => {
  const group = useRadioGroup();

  const size = sizeProp ?? group?.size ?? 's';
  const disabled = disabledProp ?? group?.disabled;
  const error = errorProp ?? group?.error;
  const checked = group ? group.value === value : checkedProp;

  return (
    <RadioLabel className={className} $disabled={disabled} $block={block} $align={align}>
      <HiddenInput
        type="radio"
        value={value}
        name={group?.name ?? nameProp}
        checked={checked}
        disabled={disabled}
        aria-invalid={error || undefined}
        onChange={(e) => {
          group?.onChange(value);
          onChange?.(e);
        }}
        {...props}
      />
      <Circle $size={size} $error={error} aria-hidden />
      {(label || hint) && (
        <TextBlock $disabled={disabled}>
          {label && <Label $size={size}>{label}</Label>}
          {hint && <Hint>{hint}</Hint>}
        </TextBlock>
      )}
    </RadioLabel>
  )
}

export { Radio, type RadioProps };
