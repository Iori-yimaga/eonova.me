import * as React from 'react'
// write-logo.css moved to globals.css to avoid preload warning

interface WriteLogoProps {
  className?: string
}

const WriteLogo: React.FC<WriteLogoProps> = ({ className }) => {
  return (
    <svg
      id="eGgXFSmcNq71"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -5 120 55"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
    >
      <text
        x="0"
        y="42"
        fontFamily="'Yozai Medium', 'Noto Sans SC', system-ui, sans-serif"
        fontSize="48"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        慕乐
      </text>
    </svg>
  )
}

export default WriteLogo
