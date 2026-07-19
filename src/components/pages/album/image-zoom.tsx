'use client'

import Zoom from 'react-medium-image-zoom'
// image-zoom.css moved to globals.css to avoid preload warning

import 'react-medium-image-zoom/dist/styles.css'

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
