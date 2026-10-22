import styled, { css } from "styled-components";
import { Card } from "@/shared";

const NewsCardRoot = styled(Card).attrs({ as: 'article' })`
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow .2s ease;

  &:hover {
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.primary.text}14;
  }
`

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Source = styled.span`
  color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.secondary.textSecondary};
`

const Summary = styled.p`
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.primary.additionalText};
`

const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const ReadLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;

  ${({ theme }) => css`
    color: ${theme.colors.primary.primary};

    &:hover {
      color: ${theme.colors.primary.hover};
    }
  `}

  & svg {
    width: 16px;
    height: 16px;
    transition: transform .15s ease;
  }

  &:hover svg {
    transform: translateX(3px);
  }
`

export { NewsCardRoot, Meta, Source, Dot, Summary, Footer, Tags, ReadLink };
