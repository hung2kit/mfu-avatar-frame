export type CanvasSize = {
  width: number
  height: number
}

export type PortraitTransform = {
  zoom: number
  offsetXPercent: number
  offsetYPercent: number
}

const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  transform: PortraitTransform
) => {
  const sourceWidth = image.width
  const sourceHeight = image.height
  const scale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * transform.zoom

  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  const offsetX = (canvasWidth - drawWidth) / 2 + (transform.offsetXPercent / 100) * canvasWidth
  const offsetY = (canvasHeight - drawHeight) / 2 + (transform.offsetYPercent / 100) * canvasHeight

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to create PNG output'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

export const composeAvatarFrame = async (
  portrait: HTMLImageElement,
  frame: HTMLImageElement,
  size: CanvasSize,
  transform: PortraitTransform
): Promise<Blob> => {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas context is unavailable')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  drawCoverImage(context, portrait, size.width, size.height, transform)
  context.drawImage(frame, 0, 0, size.width, size.height)

  return canvasToBlob(canvas)
}

