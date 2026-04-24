export const MIN_SIZE = 100
export const MAX_SIZE = 3000

export const isValidImageFile = (file: File | null): boolean => {
  if (!file) return false
  return file.type.startsWith('image/')
}

export const readImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Failed to load image: ${file.name}`))
    }

    image.src = objectUrl
  })

export const readImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve(image)
    }

    image.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${url}`))
    }

    image.src = encodeURI(url)
  })

export const isSizeInRange = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_SIZE && value <= MAX_SIZE

