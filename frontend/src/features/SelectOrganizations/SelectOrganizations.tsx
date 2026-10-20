import { Dropdown, Text } from "@/shared"
import { useState } from "react"

const SelectOrganizations = () => {
  const [organizations, setOrganizations] = useState<Array<string>>([])

  return (
    <Dropdown 
      render={(ref, selected) => <Text.S2 ref={ref}>{selected.length === 0 ? 'Выберете организации' : `Выбрано ${selected.length}`}</Text.S2>}
      options={[]}
    />
  )
}

export { SelectOrganizations };
