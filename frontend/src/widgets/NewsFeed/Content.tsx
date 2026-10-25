import { useCompanyAnalysis, useSession } from "@/entities"
import { useCallback, useState, type ReactNode } from "react"
import { Button, Card, SubmitField, Title } from "@/shared"
import { Purpose, StateIcon, StateMessage, StateText } from "./NewsFeed.styled"
import { useAnalysis } from "@/entities/job";
import { InsightsSkeleton } from "./InsightsSkeleton";

const FeedState = ({ icon, title, text, action }: { icon: string, title: string, text?: string, action?: ReactNode }) => (
  <Card>
    <StateMessage>
      <StateIcon aria-hidden>{icon}</StateIcon>
      <Title.H5>{title}</Title.H5>
      {text && <StateText>{text}</StateText>}
      {action}
    </StateMessage>
  </Card>
)

const Content = () => {
  const { companyId, role, userId } = useSession();
  const [purposeValue, setPurpose] = useState<string>()

  const { mutateAsync, data: jobId, isPending, isError } = useCompanyAnalysis();
  const { isConnect, isProgress, isError: isAnalysisError, isFail } = useAnalysis(jobId)
  const mutationFn = useCallback(async (goal?: string) => {
    setPurpose(goal)
    return await mutateAsync({
      goal,
      demoUserId: userId,
      companyId: companyId ?? undefined,
      role: role ?? undefined
    })
  }, [companyId, mutateAsync, role, userId])
  if (companyId === null || role === null) {
      return (
        <FeedState
          icon="🏢"
          title="Выберите организацию и роль"
          text="Подберём новости по отрасли и региону вашей компании с учётом вашей роли."
        />
      )
    }

    // загрузка идёт от отправки запроса до финального события SSE — включая промежуточный прогресс
    if (isPending || isConnect || isProgress) {
      return (
        <>
          <Purpose>
            <SubmitField value={purposeValue} isLoading placeholder="Введите цель (не обязательно)" />
          </Purpose>
          <InsightsSkeleton />
        </>
      );
    }

    if (isError) {
      return (
        <FeedState
          icon="⚠️"
          title="Не удалось загрузить новости"
          text="Проверьте соединение и попробуйте ещё раз."
          action={<Button variant="secondary" borderSize="S">Повторить</Button>}
        />
      )
    }

    return (
      <>
        <Purpose>
          <SubmitField value={purposeValue} onSubmit={value => mutationFn(value)} onInput={e =>setPurpose(e.currentTarget.value)} placeholder="Введите цель (не обязательно)" />
        </Purpose>
      </>
    )
}

export { Content }