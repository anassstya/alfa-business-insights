import { useCallback, type CSSProperties } from "react"
import { toast, type ToastOptions } from "react-hot-toast"
import { useTheme, type DefaultTheme } from "styled-components"

interface ToastParams {
  type?: 'success' | 'warning' | 'info' | 'error',
  icon?: string,
  message: string,
}

const TOAST_BASE_OPTIONS: ToastOptions = {
  duration: 3000,
  position: 'bottom-center',

}

const useSnackBar = () => {
  const theme = useTheme() as DefaultTheme;

  const mapColorByType = useCallback(({ type = 'info' }: Pick<ToastParams, 'type'>): CSSProperties => {
    return {
      backgroundColor: theme.colors.utility[type]
    }
  }, [theme.colors.utility])

  return useCallback(({ type = 'info', icon, message }: ToastParams) => {
    return toast(message, {
      ...TOAST_BASE_OPTIONS,
      style: mapColorByType({ type }),
      icon,
    })
  }, [mapColorByType])
}

export { useSnackBar };
