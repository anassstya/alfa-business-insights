import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import ChevronIcon from '../../icons/chevron-down.svg?react'
import CheckIcon from '../../icons/check.svg?react'
import {
  Caption, Chevron, Option, OptionDescription, OptionLabel, OptionText,
  Popover, PopoverMessage, SelectRoot, Trigger, TriggerText, Value,
} from "./Select.styled";

interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectProps<T extends string | number> {
  options: SelectOption<T>[];
  value: T | null;
  onChange(value: T): void;
  caption?: string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: string;
  fullWidth?: boolean;
}

const Select = <T extends string | number>({
  options,
  value,
  onChange,
  caption,
  placeholder = 'Выберите',
  loading = false,
  disabled = false,
  emptyText = 'Нет вариантов',
  fullWidth = false,
}: SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen])

  const open = () => {
    setHighlighted(Math.max(0, options.findIndex(option => option.value === value)));
    setIsOpen(true);
  }

  const select = (option: SelectOption<T>) => {
    onChange(option.value);
    setIsOpen(false);
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        open();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlighted(prev => Math.min(options.length - 1, prev + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlighted(prev => Math.max(0, prev - 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (options[highlighted]) select(options[highlighted]);
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }

  return (
    <SelectRoot ref={rootRef} $fullWidth={fullWidth}>
      <Trigger
        type="button"
        $open={isOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => isOpen ? setIsOpen(false) : open()}
        onKeyDown={handleKeyDown}
      >
        {selectedOption?.icon}
        <TriggerText>
          {caption && <Caption>{caption}</Caption>}
          <Value $placeholder={!selectedOption}>
            {selectedOption?.label ?? (loading ? 'Загрузка…' : placeholder)}
          </Value>
        </TriggerText>
        <Chevron $open={isOpen}><ChevronIcon /></Chevron>
      </Trigger>

      {isOpen && (
        <Popover id={listId} role="listbox">
          {loading && <PopoverMessage>Загрузка…</PopoverMessage>}
          {!loading && options.length === 0 && <PopoverMessage>{emptyText}</PopoverMessage>}
          {!loading && options.map((option, index) => (
            <Option
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              $active={option.value === value}
              $highlighted={index === highlighted}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => select(option)}
            >
              {option.icon}
              <OptionText>
                <OptionLabel>{option.label}</OptionLabel>
                {option.description && <OptionDescription>{option.description}</OptionDescription>}
              </OptionText>
              <CheckIcon />
            </Option>
          ))}
        </Popover>
      )}
    </SelectRoot>
  )
}

export { Select, type SelectOption, type SelectProps };
