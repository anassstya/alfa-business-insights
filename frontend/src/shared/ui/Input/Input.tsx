import { forwardRef, useImperativeHandle, useRef, useState, type ComponentProps, type RefObject } from "react";
import { InputBase, StyledClearButton, StyledInput } from "./Input.styled";
import CloseIcon from '../../icons/cross-icon.svg?react'

interface Props extends Omit<ComponentProps<'input'>, 'ref'>{
  allowClear?: boolean;
  containerElRef?: RefObject<HTMLDivElement | null>
}

const ClearButton = ({
  inputRef,
  initialValue = '',
}: {
  inputRef: RefObject<HTMLInputElement | null>
  initialValue: string
}) => {
  const onClickHandler = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set
      nativeInputValueSetter!.call(inputRef.current, initialValue)
      const event = new Event('input', { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }
  }
  return (
    <StyledClearButton onClick={onClickHandler}>
      <CloseIcon />
    </StyledClearButton>
  )
}

const Input = forwardRef<HTMLInputElement, Props>(({allowClear = true, containerElRef, ...props}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isHovered, setHovered] = useState(false);
  useImperativeHandle(ref, () => inputRef.current!, [])
  return (
    <InputBase
      ref={containerElRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <StyledInput ref={inputRef} {...props} />
      {allowClear && isHovered && (
          <ClearButton
            inputRef={inputRef}
            initialValue={''}
          />
        )}
    </InputBase>
  )
})

export { Input, type Props as InputProps }