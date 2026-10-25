import styled from "styled-components";
import { Flex, Skeleton, VisuallyHidden } from "@/shared";
import { UserCard } from "./Entrypoint.styled";

const LoaderRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

/** Карточка пользователя серая (sectionBg) — полоски того же цвета были бы не видны, берём темнее */
const Bar = styled(Skeleton)`
  background-color: ${({ theme }) => theme.colors.secondary.border};
`

/**
 * Лоадер списка демопользователей: повторяет карточку UserCard —
 * синтетический код и кружок радиокнопки сверху, фамилия и имя снизу.
 * Пульсация идёт волной от карточки к карточке.
 */
const UsersLoader = ({ count = 3 }: { count?: number }) => (
  <LoaderRoot role="status" aria-live="polite" aria-busy>
    <VisuallyHidden>Загружаем пользователей…</VisuallyHidden>
    {Array.from({ length: count }, (_, i) => {
      const delay = { animationDelay: `${i * 0.15}s` };

      return (
        <UserCard key={i} aria-hidden>
          <Flex justify="space-between" align="center">
            <Bar $width="88px" $height="20px" style={delay} />
            <Bar $width="20px" $height="20px" $radius="50%" style={delay} />
          </Flex>
          <Bar $width={`${150 + (i % 2) * 40}px`} $height="14px" style={delay} />
        </UserCard>
      )
    })}
  </LoaderRoot>
)

export { UsersLoader };
