import { Button, Chip, Flex, Modal, Radio, RadioGroup, Select, Text } from "@/shared"
import { useEffect, useMemo, useState } from "react";
import { Form, UserCard } from "./Entrypoint.styled";
import { Controller, useForm } from "react-hook-form";
import { useCompanies, useRoleContext, useSession, type RoleId } from "@/entities";
import { useDemoUsers } from "@/entities/users";

const FORM_VALUE = [{value: 'users', label: 'Пользователь'}, { value: 'custom', label: 'Пользовательский'}]

const Entrypoint = () => {
  const [showHelloModal, setHelloModal] = useState(true)
  const { data: companies } = useCompanies({ limit: 200 })
  const { control, handleSubmit, watch, setValues } 
    = useForm<{companyId: number, role: string, formType: string, userId: number}>({
      defaultValues: { role: undefined, formType: 'users' },
    })
  const companiesOptions = useMemo(() => (companies?.items ?? []).map(({ id, industry_name }) => ({ value: id, label: industry_name })),[companies?.items])
  const roles = useRoleContext()
  const options = useMemo(() => roles.map(role => ({value: role.code, label: role.full_name})),[roles])
  const { setRole, setCompanyId } = useSession()
  const formType = watch('formType')
  useEffect(() => {
    setValues({
        formType,
        companyId: undefined,
        role: undefined,
        userId: undefined,
      }, { shouldTouch: true })
  }, [formType, setValues])
  const { data: users = []} = useDemoUsers();
  const onSubmit = ({companyId , role}: { companyId: number, role: string}) => {
    setRole(role)
    console.log(role)
    // TODO: Из списка компаний получить всех, где есть пользователь, отфильтровать и записать первую оргу
    setHelloModal(false)
  }
  return (
    <Modal header="Выберете пользователя" width={600} onClose={() => setHelloModal(false)} opened={showHelloModal}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller control={control} name="userId" render={({ field: { value, onChange }}) => (
          <RadioGroup value={String(value)} onChange={onChange}>
            {formType === 'users' && users.map(({id, first_name, last_name}) => (
              <UserCard key={id} onClick={() => {setValues({ userId: id, formType: 'users' }, { shouldTouch: true })}}>
                <Flex justify="space-between">
                  <Text.S1>123</Text.S1>
                  <Radio value={String(id)} />
                </Flex>
                <Text.S3>{last_name} {first_name}</Text.S3>
              </UserCard>
            ))}
          </RadioGroup>
        )}/>
        {formType === 'custom' && (
          <>
            <Controller
              name="companyId"
              rules={{required: true}}
              control={control}
              render={({field: {value, onChange}}) => <Select options={companiesOptions} caption="Выберете компанию" value={value} onChange={onChange} />}
            />
            <Controller
              name="role"
              rules={{required: true}}
              control={control}
              render={({field: {value, onChange}}) => <Select options={options} caption="Выберете роль" value={value} onChange={onChange} />}
            />
          </>
        )}
        <Controller name="formType" control={control} render={({field: {value, onChange }}) => (
          <Flex gap="8px">
            {FORM_VALUE.map(preset => (
              <Chip
                key={preset.value}
                type="button"
                role="radio"
                value={value}
                $active={value === preset.value}
                onClick={() => onChange(preset.value)}
              >
                {preset.label}
              </Chip>
            ))}
        </Flex>
        )}/>
        <Flex justify="end">
          <Button>Выбрать</Button>
        </Flex>
      </Form>
    </Modal>
  )
}

export { Entrypoint };
