import { Main, PageRoot } from "./AlfaMainPage.styled"
import { Overview } from "./ui/Overview"
import { QuickActions } from "./ui/QuickActions"
import { Sidebar } from "./ui/Sidebar"
import { Summary } from "./ui/Summary"
import { Topbar } from "./ui/Topbar"

/** Статичная вёрстка главной Альфа-Бизнес Онлайн — элементы не интерактивны */
const AlfaMainPage = () => (
  <PageRoot>
    <Sidebar />
    <Main>
      <Topbar />
      <QuickActions />
      <Overview />
      <Summary />
    </Main>
  </PageRoot>
)

export { AlfaMainPage };
