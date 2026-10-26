import { Button, Flex, Modal, Radio, RadioGroup, Text } from "@/shared"
import { useState } from "react";
import { Form, UserCard } from "./Entrypoint.styled";
import { UsersLoader } from "./UsersLoader";
import { Controller, useForm } from "react-hook-form";
import { useSession } from "@/entities";
import { useDemoUsers } from "@/entities/users";

// const FORM_VALUE = [{value: 'users', label: 'Пользователь'}, { value: 'custom', label: 'Пользовательский'}]

const Entrypoint = () => {
  const [showHelloModal, setHelloModal] = useState(true)
  const onClose = () => setHelloModal(false)
  // const {
  //   data: companies, isPending: companiesPending, hasNextPage, isFetchingNextPage, fetchNextPage,
  // } = useInfiniteCompanies()
  // const companiesOptions = useMemo(() => (companies?.companies ?? []).map(company => ({
  //   value: company.id,
  //   label: getCompanyLabel(company),
  //   description: getCompanyDescription(company),
  // })),[companies?.companies])
  const { control, handleSubmit, watch, setValues } 
    = useForm<{companyId: number, role: string, formType: string, userId: number}>({
      defaultValues: { role: undefined, formType: 'users' },
    })
  // const roles = useRoleContext()
  // const options = useMemo(() => roles.map(role => ({value: role.code, label: role.full_name})),[roles])
  const { setRole, setCompanyId, setUserId } = useSession()
  const formType = watch('formType')
  // useEffect(() => {
  //   setValues({
  //       formType,
  //       companyId: undefined,
  //       role: undefined,
  //       userId: undefined,
  //     }, { shouldTouch: true })
  // }, [formType, setValues])
  const { data: users = [], isPending: usersPending } = useDemoUsers();
  const onSubmit = ({companyId , role, userId }: { userId: number, companyId: number, role: string}) => {
    if (role && companyId) {
      setRole(role)
      setCompanyId(companyId)
    }

    if (userId) {
      setUserId(userId)
    }
    setHelloModal(false)
  }
  return (
    <Modal preventSimpleClose header="Выберете пользователя" width={600} onClose={onClose} opened={showHelloModal}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller control={control} name="userId" render={({ field: { value, onChange }}) => (
          <RadioGroup value={String(value)} onChange={onChange}>
            {formType === 'users' && usersPending && <UsersLoader />}
            {formType === 'users' && !usersPending && users.map(({id, first_name, last_name, synthetic_f }) => (
              <UserCard key={id} onClick={() => {setValues({ userId: id, formType: 'users' }, { shouldTouch: true })}}>
                <Flex justify="space-between">
                  <Text.S1>{synthetic_f}</Text.S1>
                  <Radio value={String(id)} />
                </Flex>
                <Text.S3>{last_name} {first_name}</Text.S3>
              </UserCard>
            ))}
          </RadioGroup>
        )}/>
        {/* {formType === 'custom' && (
          <>
            <Controller
              name="companyId"
              rules={{required: true}}
              control={control}
              render={({field: {value, onChange}}) => (
                <Select
                  options={companiesOptions}
                  caption="Выберете компанию"
                  value={value}
                  onChange={onChange}
                  loading={companiesPending}
                  hasMore={hasNextPage}
                  loadingMore={isFetchingNextPage}
                  onLoadMore={fetchNextPage}
                />
              )}
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
        )}/> */}
        <Flex justify="end">
          <Button>Выбрать</Button>
        </Flex>
      </Form>
    </Modal>
  )
}

export { Entrypoint };
