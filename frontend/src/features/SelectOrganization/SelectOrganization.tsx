import { useEffect } from "react"
import { useCompanies, useSession } from "@/entities"
import { Select } from "@/shared"

const COMPANIES_LIMIT = 150;

const SelectOrganization = () => {
  const { companyId, setCompanyId } = useSession();
  const { data, isPending, isError } = useCompanies({ limit: COMPANIES_LIMIT });

  const options = (data?.items ?? []).map(company => ({
    value: company.id,
    label: company.synthetic_u,
    description: [company.industry_name, company.city].filter(Boolean).join(' · '),
  }));

  // сохранённая в localStorage организация могла пропасть из выдачи
  useEffect(() => {
    if (data && companyId !== null && !data.items.some(company => company.id === companyId)) {
      setCompanyId(null);
    }
  }, [data, companyId, setCompanyId])

  return (
    <Select
      caption="Организация"
      placeholder={isError ? 'Не удалось загрузить' : 'Выберите организацию'}
      emptyText="Организации не найдены"
      options={options}
      value={companyId}
      onChange={setCompanyId}
      loading={isPending}
      fullWidth
    />
  )
}

export { SelectOrganization };
