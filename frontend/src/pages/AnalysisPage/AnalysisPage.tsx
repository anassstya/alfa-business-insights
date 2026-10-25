import { useNavigate, useParams } from "react-router-dom";
import { getCompanyLabel, useCompany, useRoleContext } from "@/entities";
import { useAnalysisResult } from "@/entities/job";
import { AnalysisChat } from "@/features";
import { AnalysisReport, InsightsSkeleton } from "@/widgets";
import { Button, Card, Text, Title } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'
import { BackLink, ChatAside, Hero, Layout, MainColumn, MetaLine, PageRoot } from "./AnalysisPage.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Страница деталей анализа: полный отчёт и чат с ассистентом сбоку */
const AnalysisPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const roles = useRoleContext();

  const { result, isLoading, isError, progress, error } = useAnalysisResult(jobId);
  const { data: company } = useCompany(result?.company_id ?? null);

  const roleName = roles.find(role => role.code === result?.role)?.full_name ?? result?.role;
  const createdAt = result?.created_at ? dateFormatter.format(new Date(result.created_at)) : null;

  const renderReport = () => {
    if (result) return <AnalysisReport result={result} />;

    if (isLoading) {
      return (
        <>
          {progress?.message && <Text.P2>{progress.message}{progress.progress !== undefined && ` · ${progress.progress}%`}</Text.P2>}
          <InsightsSkeleton />
        </>
      );
    }

    if (isError) {
      return (
        <Card>
          <Title.H5>Результат анализа недоступен</Title.H5>
          <Text.P2 style={{ margin: '8px 0 16px' }}>
            {error ?? 'Анализ не найден или ещё не завершён. Запустите его заново со страницы аналитики.'}
          </Text.P2>
          <Button variant="secondary" borderSize="S" onClick={() => navigate('/insights')}>
            Вернуться к аналитике
          </Button>
        </Card>
      );
    }

    return null;
  }

  return (
    <PageRoot>
      <Layout>
        {/* заголовок — в левой колонке, чтобы чат начинался сразу под шапкой и целиком помещался в экран */}
        <MainColumn>
          <BackLink type="button" onClick={() => navigate('/insights')}>
            <ArrowIcon />
            К новостной аналитике
          </BackLink>

          <Hero>
            <Title.H2>Аналитика по компании</Title.H2>
            {result && (
              <MetaLine>
                <span>Компания: <b>{company ? getCompanyLabel(company) : `#${result.company_id}`}</b></span>
                {roleName && <span>Роль: <b>{roleName}</b></span>}
                {result.goal && <span>Цель: <b>{result.goal}</b></span>}
                {createdAt && <span>{createdAt}</span>}
              </MetaLine>
            )}
          </Hero>

          {renderReport()}
        </MainColumn>
        {jobId && (
          <ChatAside>
            <AnalysisChat key={jobId} jobId={jobId} disabled={!result} />
          </ChatAside>
        )}
      </Layout>
    </PageRoot>
  )
}

export { AnalysisPage };
