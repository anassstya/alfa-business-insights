import { Chip, DateField, toIsoDate } from "@/shared";
import { DATE_PRESETS, DEFAULT_DATE_FILTER, isDateFilterActive, type DateFilterValue } from "../model/dateFilter";
import { CustomRange, FilterHeader, FilterLabel, FilterRoot, Presets, ResetButton } from "./NewsDateFilter.styled";

interface Props {
  value: DateFilterValue;
  onChange(value: DateFilterValue): void;
}

const NewsDateFilter = ({ value, onChange }: Props) => {
  const today = toIsoDate(new Date());

  return (
    <FilterRoot>
      <FilterHeader>
        <FilterLabel>Период публикации</FilterLabel>
        {isDateFilterActive(value) && (
          <ResetButton type="button" onClick={() => onChange(DEFAULT_DATE_FILTER)}>
            Сбросить
          </ResetButton>
        )}
      </FilterHeader>

      <Presets role="radiogroup" aria-label="Период публикации">
        {DATE_PRESETS.map(preset => (
          <Chip
            key={preset.value}
            type="button"
            role="radio"
            aria-checked={value.preset === preset.value}
            $active={value.preset === preset.value}
            onClick={() => onChange({ ...value, preset: preset.value })}
          >
            {preset.label}
          </Chip>
        ))}
      </Presets>

      {value.preset === 'custom' && (
        <CustomRange>
          <DateField
            caption="С"
            value={value.from}
            max={value.to || today}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <DateField
            caption="По"
            value={value.to}
            min={value.from || undefined}
            max={today}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </CustomRange>
      )}
    </FilterRoot>
  )
}

export { NewsDateFilter };
