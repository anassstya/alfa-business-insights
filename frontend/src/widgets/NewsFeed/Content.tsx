import { getCompanyLabel, useCompany, useRoleContext, useSession, useStartCompanyAnalysis } from "@/entities"
import { useState, type ReactNode } from "react"
import { Button, Card, Title } from "@/shared"
import { AnalysisSessionsMenu, Purpose } from "@/features"
import {
  Launcher, LauncherHeader, LauncherHint, LauncherTitle, StateIcon, StateMessage, StateText,
} from "./NewsFeed.styled"
import { useQueryClient } from "@tanstack/react-query";
import { analysisKeys, useAnalysisSessions } from "@/entities/job";
import { Chat } from "../Chat";

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
  const { companyId, role, userId, purpose, activeJobId, setActiveJobId } = useSession();
  const roles = useRoleContext();
  const { data: company } = useCompany(companyId);
  const { addSession } = useAnalysisSessions(userId);
  const queryClient = useQueryClient();

  // запуск — только здесь и только по кнопке «Начать анализ»; за ходом анализа (SSE) следит чат
  const start = useStartCompanyAnalysis();
  const [isJobRunning, setIsJobRunning] = useState(false);

  const canStart = companyId !== null && role !== null;
  const isRunning = start.isPending || isJobRunning;

  const startAnalysis = (goal: string) => {
    if (companyId === null || role === null) return;

    // пока создаётся новая задача, прошлая сессия в ленте не показывается
    setActiveJobId(undefined);
    start.mutate({ companyId, role, demoUserId: userId, goal }, {
      onSuccess: (jobId) => {
        addSession({
          jobId,
          companyId,
          companyLabel: company ? getCompanyLabel(company) : `Компания #${companyId}`,
          role,
          roleLabel: roles.find(r => r.code === role)?.full_name ?? role,
          goal: goal || undefined,
          createdAt: new Date().toISOString(),
        });
        setActiveJobId(jobId);
        // новая задача уже в истории на сервере — обновляем «Мои отчёты»
        if (userId) queryClient.invalidateQueries({ queryKey: analysisKeys.history(userId) });
      },
    });
  }

  return (
    <>
      <Launcher>
        <LauncherHeader>
          <LauncherTitle>Анализ новостей</LauncherTitle>
          <AnalysisSessionsMenu />
        </LauncherHeader>
        {!canStart && <LauncherHint>Выберите организацию и роль в шапке, чтобы запустить анализ</LauncherHint>}
        <Purpose onStart={startAnalysis} isRunning={isRunning} disabled={!canStart} />
      </Launcher>

      {!activeJobId && start.isError && (
        <FeedState
          icon="⚠️"
          title="Не удалось запустить анализ"
          text="Проверьте соединение и попробуйте ещё раз."
          action={<Button variant="secondary" borderSize="S" onClick={() => startAnalysis(start.variables?.goal ?? '')}>Повторить</Button>}
        />
      )}

      {!start.isError && activeJobId && (
        <Chat
          key={activeJobId ?? 'no-session'}
          jobId={activeJobId}
          onRunningChange={setIsJobRunning}
          onRestart={canStart ? () => startAnalysis((purpose ?? '').trim()) : undefined}
        />
      )}
    </>
  )
}

export { Content }
