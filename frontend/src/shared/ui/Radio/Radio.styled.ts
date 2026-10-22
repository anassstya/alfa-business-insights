import styled, { css } from "styled-components";

type RadioSize = 's' | 'm';

const CIRCLE_SIZE: Record<RadioSize, number> = { s: 20, m: 24 };
const CHECKED_BORDER: Record<RadioSize, number> = { s: 6, m: 7 };

const RadioLabel = styled.label<{ $disabled?: boolean, $block?: boolean, $align: 'start' | 'center' }>`
  position: relative;
  display: ${({ $block }) => $block ? 'flex' : 'inline-flex'};
  align-items: ${({ $align }) => $align === 'center' ? 'center' : 'flex-start'};
  gap: 12px;
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  user-select: none;
  -webkit-tap-highlight-color: transparent;
`

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
`

const Circle = styled.span<{ $size: RadioSize, $error?: boolean }>`
  flex-shrink: 0;
  box-sizing: border-box;
  border-radius: 50%;
  transition: border-width .15s ease, border-color .15s ease, box-shadow .15s ease;

  ${({ theme, $size, $error }) => {
    const accent = $error ? theme.colors.utility.error : theme.colors.primary.primary;

    return css`
      width: ${CIRCLE_SIZE[$size]}px;
      height: ${CIRCLE_SIZE[$size]}px;
      margin-top: ${$size === 's' ? 2 : 0}px;
      background-color: ${theme.colors.secondary.cardBg};
      border: 1px solid ${$error ? theme.colors.utility.error : theme.colors.secondary.textSecondary};

      ${HiddenInput}:checked + & {
        border-width: ${CHECKED_BORDER[$size]}px;
        border-color: ${accent};
      }

      ${RadioLabel}:hover ${HiddenInput}:not(:disabled) + & {
        border-color: ${$error ? accent : theme.colors.primary.text};
      }

      ${RadioLabel}:hover ${HiddenInput}:checked:not(:disabled) + & {
        border-color: ${$error ? accent : theme.colors.primary.hover};
      }

      ${HiddenInput}:focus-visible + & {
        box-shadow: 0 0 0 2px ${theme.colors.secondary.cardBg}, 0 0 0 4px ${theme.colors.primary.text};
      }

      ${HiddenInput}:disabled + & {
        opacity: .3;
      }
    `
  }}
`

const TextBlock = styled.span<{ $disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  opacity: ${({ $disabled }) => $disabled ? .3 : 1};
`

const Label = styled.span<{ $size: RadioSize }>`
  font-size: ${({ $size }) => $size === 's' ? 16 : 18}px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.primary.text};
`

const Hint = styled.span<{ $error?: boolean }>`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme, $error }) => $error ? theme.colors.utility.error : theme.colors.secondary.textSecondary};
`

const GroupRoot = styled.fieldset`
  margin: 0;
  padding: 0;
  border: none;
  min-width: 0;
`

const GroupTitle = styled.legend`
  margin-bottom: 16px;
  padding: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary.text};
`

const GroupItems = styled.div<{ $direction: 'vertical' | 'horizontal' }>`
  display: flex;
  ${({ $direction }) => $direction === 'vertical' ? css`
    flex-direction: column;
    gap: 16px;
  ` : css`
    flex-wrap: wrap;
    gap: 16px 24px;
  `}
`

const GroupHint = styled(Hint)`
  display: block;
  margin-top: 12px;
`

export {
  RadioLabel, HiddenInput, Circle, TextBlock, Label, Hint,
  GroupRoot, GroupTitle, GroupItems, GroupHint,
  type RadioSize,
};
