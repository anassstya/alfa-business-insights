import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getCompanyLabel, useCompany, useRoleContext, useSession } from "@/entities";
import {
  getJobStatusLabel, getJobStatusTone, useAnalysisSessions, useDemoUserAnalysisJobs,
} from "@/entities/job";
import ChevronIcon from '@/shared/icons/chevron-down.svg?react'
import CrossIcon from '@/shared/icons/cross-icon.svg?react'
import {
  Count, EmptyText, Item, ItemButton, ItemMeta, ItemTitle, ItemTop, List, MenuRoot, NewButton, Popover,
  RemoveButton, StatusBadge, Trigger,
} from "./AnalysisSessionsMenu.styled";

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface ReportItem {
  jobId: string;
  companyId: number;
  role: string;
  goal?: string | null;
  createdAt: string;
  status?: string;
  companyLabel?: string;
  roleLabel?: string;
  fromServer: boolean;
}

const ReportRow = ({ item, active, onSelect, onRemove }: {
  item: ReportItem;
  active: boolean;
  onSelect(): void;
  onRemove(): void;
}) => {
  const roles = useRoleContext();
  const { data: company } = useCompany(item.companyLabel ? null : item.companyId);

  const companyLabel = item.companyLabel ?? (company ? getCompanyLabel(company) : `Компания #${item.companyId}`);
  const roleLabel = item.roleLabel ?? roles.find(role => role.code === item.role)?.full_name ?? item.role;
  const meta = [dateFormatter.format(new Date(item.createdAt)), roleLabel, companyLabel].join(' · ');

  return (
    <Item $active={active}>
      <ItemButton type="button" aria-current={active || undefined} onClick={onSelect}>
        <ItemTop>
          <ItemTitle>{item.goal || 'Отчёт без цели'}</ItemTitle>
          {item.status && <StatusBadge $tone={getJobStatusTone(item.status)}>{getJobStatusLabel(item.status)}</StatusBadge>}
        </ItemTop>
        <ItemMeta>{meta}</ItemMeta>
      </ItemButton>
      {!item.fromServer && (
        <RemoveButton type="button" title="Убрать из списка" aria-label="Убрать из списка" onClick={onRemove}>
          <CrossIcon />
        </RemoveButton>
      )}
    </Item>
  )
}

const AnalysisSessionsMenu = () => {
  const { userId, activeJobId, setActiveJobId } = useSession();
  const { sessions, removeSession } = useAnalysisSessions(userId);
  const history = useDemoUserAnalysisJobs(userId);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const items = useMemo<ReportItem[]>(() => {
    const local = new Map(sessions.map(session => [session.jobId, session]));

    const fromServer = (history.data ?? []).map(job => ({
      jobId: job.job_id,
      companyId: job.company_id,
      role: job.role,
      goal: job.goal,
      createdAt: job.created_at,
      status: job.status,
      companyLabel: local.get(job.job_id)?.companyLabel,
      roleLabel: local.get(job.job_id)?.roleLabel,
      fromServer: true,
    }));
    const serverIds = new Set(fromServer.map(item => item.jobId));
    const localOnly = sessions
      .filter(session => !serverIds.has(session.jobId))
      .map(session => ({ ...session, fromServer: false }));

    return [...fromServer, ...localOnly]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [history.data, sessions])

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

  const toggle = () => {
    // статусы отчётов меняются — при каждом открытии берём свежую историю
    if (!isOpen && userId) history.refetch();
    setIsOpen(open => !open);
  }

  const select = (jobId: string | undefined) => {
    setActiveJobId(jobId);
    setIsOpen(false);
  }

  const remove = (jobId: string) => {
    removeSession(jobId);
    if (jobId === activeJobId) setActiveJobId(undefined);
  }

  const isHistoryLoading = !!userId && history.isPending;

  return (
    <MenuRoot ref={rootRef}>
      <Trigger
        type="button"
        $open={isOpen}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={popoverId}
        onClick={toggle}
      >
        Мои отчёты
        {items.length > 0 && <Count>{items.length}</Count>}
        <ChevronIcon />
      </Trigger>

      {isOpen && (
        <Popover id={popoverId}>
          <NewButton type="button" onClick={() => select(undefined)}>+ Новый отчёт</NewButton>

          {history.isError && <EmptyText $error>Не удалось загрузить историю отчётов</EmptyText>}
          {isHistoryLoading && items.length === 0 && <EmptyText>Загружаем историю…</EmptyText>}
          {!isHistoryLoading && !history.isError && items.length === 0 && (
            <EmptyText>Здесь появятся запущенные отчёты</EmptyText>
          )}

          {items.length > 0 && (
            <List aria-label="Запущенные отчёты">
              {items.map(item => (
                <ReportRow
                  key={item.jobId}
                  item={item}
                  active={item.jobId === activeJobId}
                  onSelect={() => select(item.jobId)}
                  onRemove={() => remove(item.jobId)}
                />
              ))}
            </List>
          )}
        </Popover>
      )}
    </MenuRoot>
  )
}

export { AnalysisSessionsMenu };
