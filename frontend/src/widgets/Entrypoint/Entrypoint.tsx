import { Button, Flex, Modal, Select } from "@/shared"
import { useMemo, useState } from "react";
import { Form } from "./Entrypoint.styled";
import { Controller, useForm } from "react-hook-form";
import { useRoleContext, useSession, type RoleId } from "@/entities";

const Entrypoint = () => {
  const [showHelloModal, setHelloModal] = useState(true)
  const { setRole, setCompanyId } = useSession();
  const { control, handleSubmit } = useForm<{userId: number, role: RoleId}>({defaultValues: { role: undefined }});
  const roles = useRoleContext()
  console.log(roles)
  const options = useMemo(() => roles.map(role => ({value: role.role, label: role.label})),[roles])
  const onSubmit = ({userId, role}: { userId: number, role: RoleId}) => {
    // setRole(role)
    console.log(role)
    // TODO: Из списка компаний получить всех, где есть пользователь, отфильтровать и записать первую оргу
    setHelloModal(false)
  }
  return (
    <Modal header="Выберете пользователя" onClose={() => setHelloModal(false)} opened={showHelloModal}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="userId"
          control={control}
          render={({field: {value, onChange}}) => <Select options={[{ value: 123, label: '132' }]} caption="Выберете пользователя" value={value} onChange={onChange} />}
        />
        <Controller
          name="role"
          control={control}
          render={({field: {value, onChange}}) => <Select options={options} caption="Выберете роль" value={value} onChange={onChange} />}
        />
        <Flex justify="end">
          <Button>Выбрать</Button>
        </Flex>
      </Form>
    </Modal>
  )
}

export { Entrypoint };
