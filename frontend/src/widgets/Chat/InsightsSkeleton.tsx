import { Skeleton, VisuallyHidden } from "@/shared"
import { Metric, Metrics, Row, SectionLabel, SkeletonCard, SkeletonRoot } from "./InsightsSkeleton.styled"

const delay = (step: number) => ({ animationDelay: `${step * 0.12}s` })

const SummarySkeleton = () => (
  <SkeletonCard>
    <Skeleton $width="28%" $height="14px" style={delay(0)} />
    <Skeleton $width="72%" $height="26px" $radius="10px" style={delay(1)} />
    <Skeleton $height="16px" style={delay(2)} />
    <Skeleton $width="94%" $height="16px" style={delay(2)} />
    <Skeleton $width="58%" $height="16px" style={delay(3)} />
    <Metrics>
      {Array.from({ length: 3 }, (_, i) => (
        <Metric key={i}>
          <Skeleton $width="60%" $height="12px" style={delay(4 + i)} />
          <Skeleton $width="80%" $height="22px" style={delay(4 + i)} />
        </Metric>
      ))}
    </Metrics>
  </SkeletonCard>
)

const InsightCardSkeleton = ({ step }: { step: number }) => (
  <SkeletonCard>
    <Row>
      <Skeleton $width="64px" $height="20px" $radius="100px" style={delay(step)} />
      <Skeleton $width="120px" $height="14px" style={delay(step)} />
    </Row>
    <Skeleton $width="86%" $height="22px" $radius="10px" style={delay(step + 1)} />
    <Skeleton $width="54%" $height="22px" $radius="10px" style={delay(step + 1)} />
    <Skeleton $height="16px" style={delay(step + 2)} />
    <Skeleton $width="76%" $height="16px" style={delay(step + 2)} />
    <Row $justify="space-between">
      <Row $gap={6}>
        <Skeleton $width="72px" $height="22px" $radius="100px" style={delay(step + 3)} />
        <Skeleton $width="96px" $height="22px" $radius="100px" style={delay(step + 3)} />
      </Row>
      <Skeleton $width="64px" $height="16px" style={delay(step + 3)} />
    </Row>
  </SkeletonCard>
)

/**
 * Скелетон страницы новостной аналитики на время анализа:
 * карточка-сводка с метриками и список карточек-инсайтов.
 * FIXME(openapi): формат результата анализа пока не описан — структура повторяет ожидаемую
 * (сводка + инсайты), её нужно будет подогнать под реальный ответ ML.
 */
const InsightsSkeleton = ({ cards = 3 }: { cards?: number }) => (
  <SkeletonRoot role="status" aria-live="polite" aria-busy>
    <VisuallyHidden>Готовим аналитику по вашей компании…</VisuallyHidden>
    <SummarySkeleton />
    <SectionLabel>
      <Skeleton $width="160px" $height="16px" style={delay(6)} />
    </SectionLabel>
    {Array.from({ length: cards }, (_, i) => <InsightCardSkeleton key={i} step={7 + i * 2} />)}
  </SkeletonRoot>
)

export { InsightsSkeleton }
