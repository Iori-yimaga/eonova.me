'use client'

import Zoom from 'react-medium-image-zoom'
// react-medium-image-zoom/dist/styles.css 已移入 globals.css，避免预加载警告

type ImageZoomProps = {
  children: React.ReactNode
} & React.ComponentProps<typeof Zoom>

function ImageZoom(props: ImageZoomProps) {
  const { children, ...rest } = props

  return (
    <Zoom zoomMargin={40} {...rest}>
      {children}
    </Zoom>
  )
}

export default ImageZoom
