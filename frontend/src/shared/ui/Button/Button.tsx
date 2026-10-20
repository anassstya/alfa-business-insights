import type { ComponentProps, ReactNode } from "react"
import { BaseButton, type StyledButtonProps } from "./Button.styled"

interface ButtonProps extends ComponentProps<'button'>, StyledButtonProps{
  icon?: ReactNode;
  rightIcon?: boolean;
}

const Button = ({ children, icon, rightIcon = false, ...rst }: ButtonProps) => {
  return (
    <BaseButton {...rst}>
      {icon && !rightIcon && icon}
      {children}
      {icon && rightIcon && icon}
    </BaseButton>
  )
}

export { Button };
