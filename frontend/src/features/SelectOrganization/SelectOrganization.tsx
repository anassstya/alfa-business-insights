import { useMemo } from "react"
import {
  getCompanyDescription, getCompanyLabel, useCompany, useInfiniteCompanies, useSession, useUserCompanies,
  type Company,
} from "@/entities"
import { Select } from "@/shared"

const toOption = (company: Company) => ({
  value: company.id,
  label: getCompanyLabel(company),
  description: getCompanyDescription(company),
})

const SelectOrganization = () => {
  const { companyId, setCompanyId, userId } = useSession();
  const allCompanies = useInfiniteCompanies();
  const userCompanies = useUserCompanies(userId);
  const { data: selectedCompany } = useCompany(companyId);

  const source = userId ? userCompanies : allCompanies;
  const companies = useMemo(
    () => (userId ? userCompanies.data : allCompanies.data?.companies) ?? [],
    [userId, userCompanies.data, allCompanies.data],
  );

  return (
    <Select
      caption="Организация"
      placeholder={source.isError ? 'Не удалось загрузить' : 'Выберите организацию'}
      emptyText="Организации не найдены"
      options={companies.map(toOption)}
      value={companyId}
      selectedLabel={selectedCompany ? getCompanyLabel(selectedCompany) : undefined}
      onChange={v=>setCompanyId(v)}
      loading={source.isPending}
      hasMore={!userId && allCompanies.hasNextPage}
      loadingMore={!userId && allCompanies.isFetchingNextPage}
      onLoadMore={allCompanies.fetchNextPage}
      fullWidth
    />
  )
}

export { SelectOrganization };
