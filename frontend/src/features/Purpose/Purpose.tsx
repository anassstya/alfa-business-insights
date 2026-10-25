import styled from "styled-components";
import { useSession } from "@/entities"
import { BREAKPOINTS, Button, TextField } from "@/shared";

const Form = styled.form`
  display: flex;
  align-items: stretch;
  gap: 8px;

  @media ${BREAKPOINTS.phone} {
    flex-direction: column;
  }
`

const StartButton = styled(Button)`
  flex-shrink: 0;
  justify-content: center;
  min-height: 52px;
  padding: 0 24px;
  border-radius: 12px;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: .5;
  }
`

interface PurposeProps {
  /** запуск анализа с введённой целью (пустая цель — анализ без цели) */
  onStart(goal: string): void;
  /** анализ уже идёт — поле и кнопка заблокированы */
  isRunning?: boolean;
  /** нельзя запустить: например, не выбраны организация или роль */
  disabled?: boolean;
}

/**
 * Цель анализа и кнопка «Начать анализ». Цель хранится в сессии, анализ
 * запускается только по кнопке или Enter — сам по себе при вводе не стартует.
 */
const Purpose = ({ onStart, isRunning = false, disabled = false }: PurposeProps) => {
  const { purpose, setPurpose } = useSession();
  const blocked = isRunning || disabled;

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        if (!blocked) onStart((purpose ?? '').trim());
      }}
    >
      <TextField
        caption="Цель анализа"
        placeholder="Например, рост продаж (необязательно)"
        value={purpose ?? ''}
        onChange={e => setPurpose(e.target.value)}
        disabled={blocked}
        maxLength={300}
        fullWidth
      />
      <StartButton type="submit" disabled={blocked}>
        {isRunning ? 'Анализ идёт…' : 'Начать анализ'}
      </StartButton>
    </Form>
  )
}

export { Purpose, type PurposeProps }
