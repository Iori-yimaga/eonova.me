import { cn } from '~/utils/cn'
// background-font.css moved to globals.css to avoid preload warning

interface BackgroundFontProps {
  children: React.ReactNode
  className?: string
  lineHeight?: string
  isDefaultFont?: boolean
}

const BackgroundFont: React.FC<BackgroundFontProps> = ({
  children,
  className,
  lineHeight = '1.1',
  isDefaultFont = true,
}) => {
  return (
    <h6
      className={cn('page-section-title', isDefaultFont && 'font-dingtalk', className)}
      style={{
        lineHeight,
      }}
    >
      {children}
    </h6>
  )
}

export default BackgroundFont
