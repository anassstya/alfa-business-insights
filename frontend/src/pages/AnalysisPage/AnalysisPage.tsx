import { useNavigate, useParams } from "react-router-dom";
import { getCompanyLabel, useCompany, useRoleContext } from "@/entities";
import { AnalysisStageLoader, useAnalysisResult } from "@/entities/job";
import { AnalysisChat } from "@/features";
import { AnalysisReport } from "@/widgets";
import { Button, Card, Text, Title } from "@/shared";
import ArrowIcon from '@/shared/icons/arrow-right.svg?react'
import { BackLink, ChatAside, Hero, Layout, MainColumn, MetaLine, PageRoot } from "./AnalysisPage.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Страница деталей анализа: полный отчёт и чат с ассистентом сбоку */
const AnalysisPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const roles = useRoleContext();

  const { job, result, status, stage, isLoading, isError, error } = useAnalysisResult(jobId);
  // числовой id компании — в задаче; в result.company_id лежит синтетический код U_…
  const { data: company } = useCompany(job?.company_id ?? null);

  const roleName = roles.find(role => role.code === job?.role)?.full_name ?? job?.role;
  const createdAt = job?.created_at ? dateFormatter.format(new Date(job.created_at)) : null;

  const renderReport = () => {
    if (result) return <AnalysisReport result={result} />;

    if (isLoading) return <AnalysisStageLoader status={status} stage={stage} />;

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
            {job && (
              <MetaLine>
                <span>Компания: <b>{company ? getCompanyLabel(company) : `#${job.company_id}`}</b></span>
                {roleName && <span>Роль: <b>{roleName}</b></span>}
                {job.goal && <span>Цель: <b>{job.goal}</b></span>}
                {createdAt && <span>{createdAt}</span>}
              </MetaLine>
            )}
          </Hero>

          {renderReport()}
        </MainColumn>
        {jobId && (
          <ChatAside>
            <AnalysisChat key={jobId} jobId={jobId} />
          </ChatAside>
        )}
      </Layout>
    </PageRoot>
  )
}

export { AnalysisPage };
