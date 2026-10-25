import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "@/entities";
import { useAnalysisSessions, type AnalysisSession } from "@/entities/job";
import ChevronIcon from '@/shared/icons/chevron-down.svg?react'
import CrossIcon from '@/shared/icons/cross-icon.svg?react'
import {
  Count, EmptyText, Item, ItemButton, ItemMeta, ItemTitle, List, MenuRoot, NewButton, Popover, RemoveButton,
  Trigger,
} from "./AnalysisSessionsMenu.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** дата первой — подпись компании длинная и обрезается многоточием */
const sessionMeta = (session: AnalysisSession) =>
  [dateFormatter.format(new Date(session.createdAt)), session.roleLabel, session.companyLabel].join(' · ');

/**
 * «Мои анализы»: список запусков демопользователя (jobId). Выбор сессии показывает её в ленте,
 * «Новый анализ» возвращает к форме запуска.
 */
const AnalysisSessionsMenu = () => {
  const { userId, activeJobId, setActiveJobId } = useSession();
  const { sessions, removeSession } = useAnalysisSessions(userId);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen])

  const select = (jobId: string | undefined) => {
    setActiveJobId(jobId);
    setIsOpen(false);
  }

  const remove = (jobId: string) => {
    removeSession(jobId);
    if (jobId === activeJobId) setActiveJobId(undefined);
  }

  return (
    <MenuRoot ref={rootRef}>
      <Trigger
        type="button"
        $open={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        Мои отчёты
        {sessions.length > 0 && <Count>{sessions.length}</Count>}
        <ChevronIcon />
      </Trigger>

      {isOpen && (
        <Popover id={popoverId}>
          <NewButton type="button" onClick={() => select(undefined)}>+ Новый отчёт</NewButton>

          {sessions.length === 0 ? (
            <EmptyText>Здесь появятся запущенные отчёты</EmptyText>
          ) : (
            <List aria-label="Запущенные отчёты">
              {sessions.map(session => (
                <Item key={session.jobId} $active={session.jobId === activeJobId}>
                  <ItemButton
                    type="button"
                    onClick={() => select(session.jobId)}
                  >
                    <ItemTitle>{session.goal || 'Отчет без цели'}</ItemTitle>
                    <ItemMeta>{sessionMeta(session)}</ItemMeta>
                  </ItemButton>
                  <RemoveButton
                    type="button"
                    title="Убрать из списка"
                    onClick={() => remove(session.jobId)}
                  >
                    <CrossIcon />
                  </RemoveButton>
                </Item>
              ))}
            </List>
          )}
        </Popover>
      )}
    </MenuRoot>
  )
}

export { AnalysisSessionsMenu };
