import { ROLES, useSession } from "@/entities"
import { Select } from "@/shared"

const SelectRole = () => {
  const { role, setRole } = useSession();

  return (
    <Select
      caption="Моя роль"
      options={[...ROLES]}
      value={role}
      onChange={setRole}
      fullWidth
    />
  )
}

export { SelectRole };
