import { useEffect, useMemo, useState } from 'react'
import { composeAvatarFrame } from './utils/canvas'
import {
  MAX_SIZE,
  MIN_SIZE,
  isSizeInRange,
  isValidImageFile,
  readImageFromFile,
} from './utils/image'

type FileKind = 'portrait' | 'frame'
type Preset = { label: string; width: number; height: number }

const PRESETS: Preset[] = [
  { label: '1:1', width: 900, height: 900 },
  { label: '4:5', width: 1080, height: 1350 },
  { label: '16:9', width: 1600, height: 900 },
]

const baseInputStyles =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

function App() {
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [frameFile, setFrameFile] = useState<File | null>(null)
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null)
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [width, setWidth] = useState(900)
  const [height, setHeight] = useState(900)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAspectLocked, setIsAspectLocked] = useState(false)
  const [lockedAspectRatio, setLockedAspectRatio] = useState(1)
  const [dragTarget, setDragTarget] = useState<FileKind | null>(null)

  const isSizeValid = useMemo(
    () => isSizeInRange(width) && isSizeInRange(height),
    [height, width]
  )
  const canGenerate = Boolean(portraitFile && frameFile && isSizeValid && !isGenerating)
  const previewAspectRatio = `${Math.max(width, MIN_SIZE)} / ${Math.max(height, MIN_SIZE)}`

  useEffect(() => {
    return () => {
      if (portraitPreviewUrl) URL.revokeObjectURL(portraitPreviewUrl)
      if (framePreviewUrl) URL.revokeObjectURL(framePreviewUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [framePreviewUrl, portraitPreviewUrl, resultUrl])

  const handleFileUpdate = (file: File | null, kind: FileKind) => {
    if (!file) return

    if (!isValidImageFile(file)) {
      setErrorMessage('Please upload a valid image file for both portrait and frame.')
      return
    }

    setErrorMessage('')

    if (kind === 'portrait') {
      if (portraitPreviewUrl) URL.revokeObjectURL(portraitPreviewUrl)
      setPortraitFile(file)
      setPortraitPreviewUrl(URL.createObjectURL(file))
      return
    }

    if (framePreviewUrl) URL.revokeObjectURL(framePreviewUrl)
    setFrameFile(file)
    setFramePreviewUrl(URL.createObjectURL(file))
  }

  const handleWidthChange = (value: number) => {
    if (!Number.isFinite(value)) return

    setWidth(value)
    if (isAspectLocked) {
      const adjustedHeight = Math.round(value / lockedAspectRatio)
      setHeight(Math.min(MAX_SIZE, Math.max(MIN_SIZE, adjustedHeight)))
    }
  }

  const handleHeightChange = (value: number) => {
    if (!Number.isFinite(value)) return

    setHeight(value)
    if (isAspectLocked) {
      const adjustedWidth = Math.round(value * lockedAspectRatio)
      setWidth(Math.min(MAX_SIZE, Math.max(MIN_SIZE, adjustedWidth)))
    }
  }

  const applyPreset = (preset: Preset) => {
    setWidth(preset.width)
    setHeight(preset.height)
    if (isAspectLocked) {
      setLockedAspectRatio(preset.width / preset.height)
    }
  }

  const toggleAspectLock = () => {
    setIsAspectLocked((previousState) => {
      const nextState = !previousState
      if (nextState) {
        setLockedAspectRatio(width / height)
      }
      return nextState
    })
  }

  const handleGenerate = async () => {
    if (!portraitFile || !frameFile) {
      setErrorMessage('Please upload both images.')
      return
    }

    if (!isSizeValid) {
      setErrorMessage(`Width and height must be between ${MIN_SIZE} and ${MAX_SIZE}.`)
      return
    }

    setErrorMessage('')
    setIsGenerating(true)

    try {
      const [portraitImage, frameImage] = await Promise.all([
        readImageFromFile(portraitFile),
        readImageFromFile(frameFile),
      ])
      const blob = await composeAvatarFrame(portraitImage, frameImage, { width, height })

      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))
    } catch {
      setErrorMessage('Could not generate image. Please try different files.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    if (!resultUrl) return

    const anchor = document.createElement('a')
    anchor.href = resultUrl
    anchor.download = `avatar-${width}x${height}.png`
    anchor.click()
  }

  const renderUploadCard = (
    kind: FileKind,
    label: string,
    file: File | null,
    previewUrl: string | null
  ) => (
    <label
      className={`block cursor-pointer rounded-xl border-2 border-dashed p-4 text-left transition ${
        dragTarget === kind
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-slate-300 bg-slate-50 hover:border-indigo-400'
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragTarget(kind)
      }}
      onDragLeave={() => setDragTarget(null)}
      onDrop={(event) => {
        event.preventDefault()
        setDragTarget(null)
        const droppedFile = event.dataTransfer.files?.[0] ?? null
        handleFileUpdate(droppedFile, kind)
      }}
    >
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0] ?? null
          handleFileUpdate(selectedFile, kind)
        }}
      />
      <p className="text-xs text-slate-500">Click to choose or drag and drop an image file.</p>
      {file && <p className="mt-2 text-xs text-slate-600">Selected: {file.name}</p>}
      {previewUrl && (
        <img
          src={previewUrl}
          alt={`${label} preview`}
          className="mt-3 h-24 w-24 rounded-lg border border-slate-200 object-cover"
        />
      )}
    </label>
  )

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Avatar Frame Generator
        </h1>

        <div className="mt-6 space-y-4">
          {renderUploadCard('portrait', 'Upload portrait image', portraitFile, portraitPreviewUrl)}
          {renderUploadCard('frame', 'Upload frame image (PNG)', frameFile, framePreviewUrl)}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Output size</p>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={isAspectLocked}
                onChange={toggleAspectLock}
                className="h-4 w-4 accent-indigo-600"
              />
              Lock aspect ratio
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-600" htmlFor="width-input">
                Width
              </label>
              <input
                id="width-input"
                type="number"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={width}
                onChange={(event) => handleWidthChange(Number(event.target.value))}
                className={baseInputStyles}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600" htmlFor="height-input">
                Height
              </label>
              <input
                id="height-input"
                type="number"
                min={MIN_SIZE}
                max={MAX_SIZE}
                value={height}
                onChange={(event) => handleHeightChange(Number(event.target.value))}
                className={baseInputStyles}
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {!isSizeValid && (
            <p className="mt-2 text-sm text-rose-600">
              Size must be between {MIN_SIZE} and {MAX_SIZE}.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>

        {errorMessage && <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>}

        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <div style={{ aspectRatio: previewAspectRatio }} className="relative w-full">
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt="Generated avatar"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  Generated image will appear here
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!resultUrl}
          className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Download
        </button>
      </section>
    </main>
  )
}

export default App
