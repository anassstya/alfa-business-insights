import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { OptionStyled, StyledOptionsContainer } from "./Dropdown.styled";

interface Props {
  options: {
    value: string,
    label: string
  }[];
  onChange?(values: string[]): void,
  render(ref: RefObject<HTMLElement | null>, selected: string[]): ReactNode
}

const Dropdown = ({ render, options, onChange }: Props) => {
  const [selected, setSelected] = useState<string[]>([])
  const ref = useRef<HTMLElement>(null);

  // eslint-disable-next-line react-hooks/refs
  const rect = useMemo(() => ref.current?.getBoundingClientRect(), [])

  const handleChange = useCallback((value: string) => {
    if (selected.includes(value)){
      const newArr = selected.filter(v => v !== value)
      setSelected(newArr)

      return;
    }

    setSelected(prev => [...prev, value])
  }, [selected])

  useEffect(() => {
    onChange?.(selected)
  }, [selected, onChange])

  return (
    <>
      {render(ref, selected)}
      <StyledOptionsContainer width={rect?.width ?? 0} top={(rect?.top ?? 0) + (rect?.height ?? 0) + 4} left={rect?.left ?? 0}>
        {options.map(({value, label}) => (
          <OptionStyled key={value} active={selected.includes(value)} onClick={() => handleChange(value)}>{label}</OptionStyled>
        ))}
      </StyledOptionsContainer>
    </>
  )
}

export { Dropdown };
