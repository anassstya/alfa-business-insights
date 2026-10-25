import type { ComponentProps } from "react";
import { FieldCaption, FieldInput, FieldLabel } from "./TextField.styled";

interface TextFieldProps extends ComponentProps<'input'> {
  /** Подпись над значением, как у Select */
  caption?: string;
  fullWidth?: boolean;
}

/** Обычное текстовое поле в стилистике Select: подпись сверху, значение снизу */
const TextField = ({ caption, fullWidth = false, className, disabled, type = 'text', ...inputProps }: TextFieldProps) => (
  <FieldLabel className={className} $fullWidth={fullWidth} $disabled={disabled}>
    {caption && <FieldCaption>{caption}</FieldCaption>}
    <FieldInput type={type} disabled={disabled} {...inputProps} />
  </FieldLabel>
)

export { TextField, type TextFieldProps };
