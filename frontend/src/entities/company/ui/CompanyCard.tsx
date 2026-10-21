import { Badge, Card, Flex, Skeleton, Text, Title } from "@/shared";
import { useCompany } from "../model/queries";
import { Eyebrow, Fact, FactList } from "./CompanyCard.styled";

const revenueFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

const formatRevenue = (value?: number) => typeof value === 'number' ? `${revenueFormatter.format(value)} ₽` : '—';

const CompanyCardSkeleton = () => (
  <Card>
    <Flex direction="column" gap="12px">
      <Skeleton $width="40%" $height="14px" />
      <Skeleton $width="80%" $height="24px" />
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} $height="36px" />)}
    </Flex>
  </Card>
)

const CompanyCard = ({ companyId }: { companyId: number }) => {
  const { data: company, isPending, isError } = useCompany(companyId);

  if (isPending) return <CompanyCardSkeleton />;

  if (isError) {
    return (
      <Card>
        <Text.P2>Не удалось загрузить профиль организации</Text.P2>
      </Card>
    )
  }

  return (
    <Card as="section" aria-label="Профиль организации">
      <Flex direction="column" gap="8px" align="flex-start">
        <Eyebrow>Профиль организации</Eyebrow>
        <Title.H4>{company.synthetic_u}</Title.H4>
        <Flex gap="6px" style={{ flexWrap: 'wrap' }}>
          {company.org_type && <Badge>{company.org_type}</Badge>}
          {company.cl_type && <Badge $variant="accent">{company.cl_type}</Badge>}
        </Flex>
      </Flex>

      <FactList>
        <Fact>
          <dt>Отрасль</dt>
          <dd>{company.industry_name}{company.industry_code ? ` · ОКВЭД ${company.industry_code}` : ''}</dd>
        </Fact>
        <Fact>
          <dt>Город</dt>
          <dd>{[company.city, company.region].filter(Boolean).join(', ') || '—'}</dd>
        </Fact>
        <Fact>
          <dt>Выручка</dt>
          <dd>{formatRevenue(company.revenue_company)}</dd>
        </Fact>
        <Fact>
          <dt>Сотрудников</dt>
          <dd>{company.amount_workers_fns_gradation || '—'}</dd>
        </Fact>
        <Fact>
          <dt>Возраст компании</dt>
          <dd>{company.company_age_years_gradation || '—'}</dd>
        </Fact>
      </FactList>
    </Card>
  )
}

export { CompanyCard };
