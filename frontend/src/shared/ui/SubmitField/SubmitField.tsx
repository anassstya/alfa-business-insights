import { useState, type ChangeEvent, type ComponentProps, type KeyboardEvent } from "react";
import SendIcon from '../../icons/send.svg?react'
import { FieldInner, FieldInput, FieldRoot, SendButton } from "./SubmitField.styled";

interface SubmitFieldProps extends Omit<ComponentProps<'input'>, 'onSubmit' | 'size' | 'type'> {
  onSubmit?(value: string): void;
  isLoading?: boolean;
  submitLabel?: string;
  clearOnSubmit?: boolean;
}

const SubmitField = ({
  onSubmit,
  isLoading = false,
  submitLabel = 'Отправить',
  clearOnSubmit = false,
  disabled = false,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  className,
  ...inputProps
}: SubmitFieldProps) => {
  const [innerValue, setInnerValue] = useState(String(defaultValue ?? ''));
  const isControlled = value !== undefined;
  const currentValue = isControlled ? String(value) : innerValue;

  const isBlocked = disabled || isLoading;
  const canSubmit = !isBlocked && currentValue.trim().length >= 0;

  const submit = () => {
    if (!canSubmit) return;

    onSubmit?.(currentValue.trim());

    if (clearOnSubmit && !isControlled) {
      setInnerValue('');
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInnerValue(event.target.value);
    }
    onChange?.(event);
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);

    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <FieldRoot className={className} $loading={isLoading} $disabled={disabled} aria-busy={isLoading}>
      <FieldInner>
        <FieldInput
          {...inputProps}
          type="text"
          value={currentValue}
          disabled={isBlocked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <SendButton
          type="button"
          aria-label={submitLabel}
          title={submitLabel}
          disabled={!canSubmit}
          onClick={submit}
        >
          <SendIcon />
        </SendButton>
      </FieldInner>
    </FieldRoot>
  )
}

export { SubmitField, type SubmitFieldProps };
