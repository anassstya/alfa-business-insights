import { CompanyCard, useRoleContext, useSession } from "@/entities"
import { Title } from "@/shared"
import { NewsFeed } from "@/widgets"
import { Aside, Content, Hero, HeroSubtitle, MainPageStyled } from "./MainPage.styled"

const MainPage = () => {
  const { companyId, role } = useSession();

  const roles = useRoleContext();

  return (
    <MainPageStyled>
      <Hero>
        <Title.H2>Новости для вашего бизнеса</Title.H2>
        <HeroSubtitle>
          Подборка для роли <b>{roles.find(r => r.code === role)?.full_name ?? 'Роль не найдена'}</b> — только то, что влияет на вашу компанию
        </HeroSubtitle>
      </Hero>

      <Content $withAside={companyId !== null}>
        <NewsFeed />
        {companyId !== null && (
          <Aside>
            <CompanyCard companyId={companyId} />
          </Aside>
        )}
      </Content>
    </MainPageStyled>
  )
}

export default MainPage
