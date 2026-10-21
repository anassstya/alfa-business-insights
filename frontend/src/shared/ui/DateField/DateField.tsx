import type { ComponentProps } from "react";
import { Field, FieldCaption, FieldInput } from "./DateField.styled";

interface DateFieldProps extends Omit<ComponentProps<'input'>, 'type'> {
  caption: string;
}

const DateField = ({ caption, ...props }: DateFieldProps) => (
  <Field>
    <FieldCaption>{caption}</FieldCaption>
    <FieldInput type="date" {...props} />
  </Field>
)

export { DateField };
