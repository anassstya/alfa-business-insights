import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { Input, type InputProps } from "../Input";
import { OptionStyled, StyledOptionsContainer } from "./Select.styled";

interface MultiSelectProps {
  multi?: true;
  onChange?(value: Array<string>): void
}

interface SelectProps {
  multi?: false;
  onChange?(value: string): void
}

type OnChangeProps = SelectProps | MultiSelectProps;

type BaseSelectProps = {
  options: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
  }>
} & OnChangeProps  & Omit<InputProps, 'readOnly' | 'onChange'>

const Select = forwardRef<HTMLInputElement, BaseSelectProps>(({options, multi = false, onChange, onFocus, onBlur, ...props}, ref) => {
  const selectRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => selectRef.current!, [])

  const [isOptionsShown, setIsOptionsShown] = useState(false);
  const [selected, setSelected] = useState<string | Array<string> | undefined>(multi ? [] : '')
  const [selectedLabel, setLabel] = useState<string>()
  const safeWidth = useMemo(() => containerRef.current?.getBoundingClientRect().width ?? 0,[])
  const safeTop = useMemo(() => (containerRef.current?.getBoundingClientRect().top ?? 0) + (containerRef.current?.getBoundingClientRect().height ?? 0) + 4,[])
  const safeLeft = useMemo(() => containerRef.current?.getBoundingClientRect().left ?? 0,[])
  const onSelect = useCallback((value: string, label: string) => {
    if (multi) {
      if (selected?.includes(value)) {
        const withoutValue = (selected as string[]).filter(v => v!==value);
        setSelected(withoutValue)
        onChange?.(withoutValue)
      }
      setSelected(prev => [...prev, value])
      onChange?.([...selected, value])
      setIsOptionsShown(false);
      
      return
    }
    setSelected(value)
    setLabel(label)
    setIsOptionsShown(false);
    onChange?.(value)
  }, [multi, onChange, selected])

  const isActiveSafe = (value: string) => {
    console.log(Array.isArray(selected) ? selected.includes(value) : selected === value)
    return Array.isArray(selected) ? selected.includes(value) : selected === value
  }
  return (
    <>
    <Input
      readOnly
      allowClear={false}
      ref={selectRef}
      containerElRef={containerRef}
      onFocus={(e) => {
        setIsOptionsShown(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setTimeout(() => setIsOptionsShown(false), 300);
        onBlur?.(e);
      }}
      defaultValue={selectedLabel}
      {...props}
    />
    {isOptionsShown && containerRef.current && (
      <StyledOptionsContainer width={safeWidth} top={safeTop} left={safeLeft}>
        {options.map(({value, label, icon}) => (
          <OptionStyled
            key={value}
            active={isActiveSafe(value)}
            onClick={() => onSelect(value,label)}
          >
            {icon}
            {label}
          </OptionStyled>
        ))}
      </StyledOptionsContainer>
    )}
    </>
  )
})

export { Select }