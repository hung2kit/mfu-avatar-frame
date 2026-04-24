import { useCallback, useEffect, useMemo, useState } from 'react'
import { composeAvatarFrame, type PortraitTransform } from './utils/canvas'
import {
  isValidImageFile,
  readImageFromFile,
  readImageFromUrl,
} from './utils/image'

type FileKind = 'portrait' | 'frame'
type BuiltInFrame = { id: string; label: string; src: string }

const BUILT_IN_FRAMES: BuiltInFrame[] = [
  { id: 'mfu-20', label: 'MFU 20 Năm', src: '/Avatar frame_20MFU.png' },
]
const CUSTOM_FRAME_ID = 'custom'
const OUTPUT_SIZE = 900
const DEFAULT_PORTRAIT_TRANSFORM: PortraitTransform = {
  zoom: 1,
  offsetXPercent: 0,
  offsetYPercent: 0,
}

function App() {
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [frameFile, setFrameFile] = useState<File | null>(null)
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null)
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | null>(null)
  const [selectedFrameId, setSelectedFrameId] = useState(BUILT_IN_FRAMES[0].id)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [dragTarget, setDragTarget] = useState<FileKind | null>(null)
  const [portraitTransform, setPortraitTransform] =
    useState<PortraitTransform>(DEFAULT_PORTRAIT_TRANSFORM)
  const selectedBuiltInFrame = useMemo(
    () => BUILT_IN_FRAMES.find((frame) => frame.id === selectedFrameId) ?? null,
    [selectedFrameId]
  )
  const activeFramePreviewUrl =
    selectedFrameId === CUSTOM_FRAME_ID ? framePreviewUrl : selectedBuiltInFrame?.src ?? null

  const canGenerate = Boolean(portraitFile && (frameFile || selectedBuiltInFrame) && !isGenerating)
  const canAutoGenerate = Boolean(portraitFile && (frameFile || selectedBuiltInFrame))
  const isPortraitStepDone = Boolean(portraitFile)
  const isFrameStepDone = Boolean(selectedBuiltInFrame || frameFile)
  const hasLivePreview = Boolean(portraitPreviewUrl && activeFramePreviewUrl)
  const previewAspectRatio = '1 / 1'

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
      setErrorMessage('Vui lòng tải lên tệp ảnh hợp lệ cho cả ảnh chân dung và khung.')
      return
    }

    setErrorMessage('')

    if (kind === 'portrait') {
      if (portraitPreviewUrl) URL.revokeObjectURL(portraitPreviewUrl)
      setPortraitFile(file)
      setPortraitPreviewUrl(URL.createObjectURL(file))
      setPortraitTransform(DEFAULT_PORTRAIT_TRANSFORM)
      return
    }

    if (framePreviewUrl) URL.revokeObjectURL(framePreviewUrl)
    setFrameFile(file)
    setFramePreviewUrl(URL.createObjectURL(file))
    setSelectedFrameId(CUSTOM_FRAME_ID)
  }

  const handleBuiltInFrameSelect = (frameId: string) => {
    setErrorMessage('')
    setSelectedFrameId(frameId)
  }

  const updatePortraitTransform = (key: keyof PortraitTransform, value: number) => {
    setPortraitTransform((previousState) => ({
      ...previousState,
      [key]: value,
    }))
  }

  const resetPortraitTransform = () => {
    setPortraitTransform(DEFAULT_PORTRAIT_TRANSFORM)
  }

  const createCompositeBlob = useCallback(async () => {
    if (!portraitFile) {
      throw new Error('Thiếu ảnh chân dung')
    }

    const frameImageSource =
      selectedFrameId === CUSTOM_FRAME_ID
        ? frameFile
          ? readImageFromFile(frameFile)
          : null
        : selectedBuiltInFrame
          ? readImageFromUrl(selectedBuiltInFrame.src)
          : null

    if (!frameImageSource) {
      throw new Error('Thiếu nguồn ảnh khung')
    }

    const [portraitImage, frameImage] = await Promise.all([
      readImageFromFile(portraitFile),
      frameImageSource,
    ])

    return composeAvatarFrame(
      portraitImage,
      frameImage,
      { width: OUTPUT_SIZE, height: OUTPUT_SIZE },
      portraitTransform
    )
  }, [frameFile, portraitFile, portraitTransform, selectedBuiltInFrame, selectedFrameId])

  const handleGenerate = async () => {
    if (!portraitFile) {
      setErrorMessage('Vui lòng tải lên ảnh chân dung.')
      return
    }

    if (!frameFile && !selectedBuiltInFrame) {
      setErrorMessage('Vui lòng chọn một khung ảnh.')
      return
    }

    setErrorMessage('')
    setIsGenerating(true)

    try {
      const blob = await createCompositeBlob()
      const nextResultUrl = URL.createObjectURL(blob)
      setResultUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        return nextResultUrl
      })
    } catch {
      setErrorMessage('Không thể tạo ảnh. Vui lòng thử tệp khác.')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (!canAutoGenerate) {
      setResultUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        return null
      })
      return
    }

    let isCancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const blob = await createCompositeBlob()
        const nextResultUrl = URL.createObjectURL(blob)
        if (isCancelled) {
          URL.revokeObjectURL(nextResultUrl)
          return
        }
        setResultUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl)
          return nextResultUrl
        })
      } catch {
        if (!isCancelled) {
          setErrorMessage('Không thể cập nhật xem trước. Vui lòng thử ảnh khác.')
        }
      }
    }, 120)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [
    canAutoGenerate,
    createCompositeBlob,
  ])

  const handleDownload = async () => {
    if (!resultUrl) return

    const anchor = document.createElement('a')
    anchor.href = resultUrl
    anchor.download = `avatar-${OUTPUT_SIZE}x${OUTPUT_SIZE}.png`
    anchor.click()
  }

  const renderUploadCard = (
    kind: FileKind,
    label: string,
    file: File | null,
    previewUrl: string | null,
    isCompleted = false
  ) => (
    <label
      className={`block cursor-pointer rounded-xl border-2 border-dashed p-4 text-left transition ${
        dragTarget === kind
          ? 'border-indigo-500 bg-indigo-50'
          : isCompleted
            ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
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
      <p className="text-xs text-slate-500">Bấm để chọn hoặc kéo thả một tệp ảnh.</p>
      {file && <p className="mt-2 text-xs text-slate-600">Đã chọn: {file.name}</p>}
      {previewUrl && (
        <img
          src={previewUrl}
          alt={`Xem trước ${label.toLowerCase()}`}
          className="mt-3 h-24 w-24 rounded-lg border border-slate-200 object-cover"
        />
      )}
    </label>
  )

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <section className="w-full rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Tạo Ảnh Đại Diện Gắn Khung
        </h1>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div
              className={`rounded-xl border p-3 ${
                isPortraitStepDone
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-100'
              }`}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bước 1 - Tải ảnh chân dung
              </p>
              {renderUploadCard(
                'portrait',
                'Tải lên ảnh chân dung',
                portraitFile,
                portraitPreviewUrl,
                isPortraitStepDone
              )}
            </div>
            <div
              className={`space-y-3 rounded-xl border p-4 ${
                isFrameStepDone
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-100'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bước 2 - Chọn khung ảnh
              </p>
              <p className="text-sm font-medium text-slate-700">Chọn khung ảnh</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {BUILT_IN_FRAMES.map((frame) => (
                  <button
                    key={frame.id}
                    type="button"
                    onClick={() => handleBuiltInFrameSelect(frame.id)}
                    className={`rounded-lg border p-2 text-center text-sm transition ${
                      selectedFrameId === frame.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    <div className="mx-auto aspect-square w-full max-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white">
                      <img
                        src={frame.src}
                        alt={`Khung ${frame.label}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="mt-2 text-xs font-medium">{frame.label}</p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleBuiltInFrameSelect(CUSTOM_FRAME_ID)}
                  disabled={!frameFile}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedFrameId === CUSTOM_FRAME_ID
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                  } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  Khung tùy chỉnh {frameFile ? '(đã sẵn sàng)' : '(tải lên bên dưới)'}
                </button>
              </div>
              {renderUploadCard(
                'frame',
                'Tải lên khung ảnh tùy chỉnh (PNG)',
                frameFile,
                framePreviewUrl,
                Boolean(frameFile)
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isGenerating ? 'Đang tạo...' : 'Tạo ảnh'}
            </button>
            {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
          </div>

          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bước 3 - Xem trước và căn chỉnh
              </p>
              <div className="mt-3">
                <label className="block">
                  <span className="mb-1 flex items-center gap-1 text-xs text-slate-600">
                    <span aria-hidden>🔍</span>
                    Thu phóng: {portraitTransform.zoom.toFixed(2)}x
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={portraitTransform.zoom}
                    disabled={!portraitFile}
                    onChange={(event) => updatePortraitTransform('zoom', Number(event.target.value))}
                    className="w-full accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white lg:w-[65%]">
                  <div style={{ aspectRatio: previewAspectRatio }} className="relative w-full">
                    {hasLivePreview ? (
                      <>
                        <img
                          src={portraitPreviewUrl ?? ''}
                          alt="Ảnh chân dung căn chỉnh"
                          className="absolute inset-0 h-full w-full object-cover"
                          style={{
                            transform: `translate(${portraitTransform.offsetXPercent}%, ${portraitTransform.offsetYPercent}%) scale(${portraitTransform.zoom})`,
                            transformOrigin: 'center',
                          }}
                        />
                        <img
                          src={activeFramePreviewUrl ?? ''}
                          alt="Xem trước khung đã chọn"
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      </>
                    ) : activeFramePreviewUrl ? (
                      <img
                        src={activeFramePreviewUrl}
                        alt="Xem trước khung đã chọn"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                        Ảnh sau khi tạo sẽ hiển thị ở đây
                      </div>
                    )}
                  </div>
                </div>
                <label className="flex h-full min-h-[180px] w-14 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2">
                  <span className="mb-2 text-center text-[11px] text-slate-600">Lên/Xuống</span>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={portraitTransform.offsetYPercent}
                    disabled={!portraitFile}
                    onChange={(event) =>
                      updatePortraitTransform('offsetYPercent', Number(event.target.value))
                    }
                    className="h-36 w-3 accent-indigo-600 [writing-mode:vertical-lr] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>
              <div className="mt-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">
                    Trái/Phải: {portraitTransform.offsetXPercent}%
                  </span>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={portraitTransform.offsetXPercent}
                    disabled={!portraitFile}
                    onChange={(event) =>
                      updatePortraitTransform('offsetXPercent', Number(event.target.value))
                    }
                    className="w-full accent-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={resetPortraitTransform}
                disabled={!portraitFile}
                className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                Đặt lại vị trí ảnh
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!resultUrl}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              Tải xuống
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
