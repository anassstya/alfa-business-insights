import { createContext, useContext } from "react";
import type { RadioSize } from "./Radio.styled";

interface RadioGroupContextValue {
  name: string;
  value: string | null;
  onChange(value: string): void;
  size: RadioSize;
  disabled?: boolean;
  error?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

const useRadioGroup = () => useContext(RadioGroupContext);

export { RadioGroupContext, useRadioGroup, type RadioGroupContextValue };
