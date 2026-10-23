import { useRoleContext, useSession } from "@/entities"
import { Select } from "@/shared"
import { useMemo } from "react";

const SelectRole = () => {
  const { role, setRole } = useSession();
  const roles = useRoleContext()
  const options = useMemo(() => roles.map(role => ({value: role.code, label: role.full_name})),[roles])

  return (
    <Select
      caption="Моя роль"
      options={options}
      value={role}
      onChange={setRole}
      fullWidth
    />
  )
}

export { SelectRole };
