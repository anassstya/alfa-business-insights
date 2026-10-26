import { getProgressText, getStageLabel, STAGE_ORDER } from "../model/stages";
import type { AnalysisStage, AnalysisStatus } from "../model/types";
import CheckIcon from '@/shared/icons/check.svg?react'
import {
  LoaderHeader, LoaderRoot, LoaderSubtitle, LoaderTitle, ProgressBar, ProgressTrack, Spinner, Step, StepMarker, Steps,
  type StepState,
} from "./AnalysisStageLoader.styled";

interface AnalysisStageLoaderProps {
  /** статус из последнего события update; нет — ещё ждём первое событие SSE */
  status?: AnalysisStatus;
  stage: AnalysisStage | null;
}

const SUBTITLE: Record<'connecting' | AnalysisStatus, string> = {
  connecting: 'Ждём первое событие от сервера',
  pending: 'Задача создана и скоро начнёт выполняться',
  running: 'Анализ выполняется — обычно это занимает несколько минут',
  completed: 'Анализ завершён',
  failed: 'Анализ не удался',
};

/** Сколько этапов уже пройдено: до pending/running без этапа — ни одного */
const getCurrentIndex = (status: AnalysisStatus | undefined, stage: AnalysisStage | null) =>
  status === 'running' && stage ? STAGE_ORDER.indexOf(stage) : -1;

const getStepState = (index: number, current: number): StepState => {
  if (current === -1 || index > current) return 'pending';
  return index < current ? 'done' : 'current';
}

/**
 * Лоадер анализа по этапам ML pipeline (AnalysisJob.stage из SSE event: update):
 * текущий этап подсвечен, пройденные отмечены галочкой.
 */
const AnalysisStageLoader = ({ status, stage }: AnalysisStageLoaderProps) => {
  const current = getCurrentIndex(status, stage);
  // этап «в работе» засчитываем наполовину, чтобы полоса двигалась сразу после старта
  const progress = current === -1 ? 0 : (current + .5) / STAGE_ORDER.length;

  return (
    <LoaderRoot role="status" aria-live="polite" aria-busy>
      <LoaderHeader>
        <Spinner aria-hidden />
        <div>
          <LoaderTitle>{getProgressText(status, stage)}</LoaderTitle>
          <LoaderSubtitle>{SUBTITLE[status ?? 'connecting']}</LoaderSubtitle>
        </div>
      </LoaderHeader>

      <ProgressTrack aria-hidden>
        <ProgressBar $value={progress} />
      </ProgressTrack>

      <Steps aria-label="Этапы анализа">
        {STAGE_ORDER.map((item, index) => {
          const state = getStepState(index, current);

          return (
            <Step key={item} $state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <StepMarker $state={state} aria-hidden>{state === 'done' && <CheckIcon />}</StepMarker>
              {getStageLabel(item)}
            </Step>
          );
        })}
      </Steps>
    </LoaderRoot>
  )
}

export { AnalysisStageLoader, type AnalysisStageLoaderProps };
