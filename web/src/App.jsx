import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  FileImage,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MODEL_INPUT_SIZE = 640

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function confidencePercent(value) {
  const confidence = Number(value ?? 0)
  return `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}%`
}

function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [result, setResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hoveredItemIndex, setHoveredItemIndex] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function chooseFile(selectedFile) {
    setError('')
    setResult(null)
    setHoveredItemIndex(null)
    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      setError('Vui lòng chọn một tệp hình ảnh.')
      return
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Ảnh cần nhỏ hơn 10 MB để xử lý ổn định.')
      return
    }
    setFile(selectedFile)
  }

  function clearFile() {
    setFile(null)
    setResult(null)
    setError('')
    setHoveredItemIndex(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function detectImage() {
    if (!file) return
    setIsLoading(true)
    setError('')
    const formData = new FormData()
    formData.append('File', file)

    try {
      // const response = await fetch('https://api.garbage.defzone.net/Detection/detect-image', {
      const response = await fetch('https://localhost:7280/detection/detect-image', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || payload.Message || 'Không thể kết nối với máy chủ nhận diện.')
      console.log('Detection result:', payload)
        setResult(payload)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  const items = result?.items || result?.Items || []
  const total = result?.totalGarbageCount ?? result?.TotalGarbageCount ?? items.length

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f2] text-[#102b2a]">
      <div className="page-grid" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="brand-mark"><span /></div>
          <span className="font-display text-xl font-semibold tracking-tight">river<span className="text-[#de704b]">/</span>trash</span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-[#52706d] md:flex">
          <span className="flex items-center gap-2"><ShieldCheck size={16} /> AI vision lab</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#de704b]" />
          <span>v1.0 / detection</span>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-8 lg:px-10 lg:pt-16">
        <div className="mb-12 max-w-3xl reveal">
          <p className="eyebrow"><Sparkles size={14} /> CÔNG CỤ NHẬN DIỆN RÁC</p>
          <h1 className="font-display mt-5 text-5xl font-semibold leading-[.98] tracking-[-0.04em] text-[#102b2a] md:text-7xl">Để dòng sông<br /><em>lên tiếng.</em></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#52706d] md:text-lg">Tải lên một khung hình từ bờ sông. Mô hình thị giác sẽ tìm và đánh dấu những gì đang trôi nổi.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <div className="panel reveal reveal-delay-1">
            <div className="flex items-center justify-between border-b border-[#dbe6df] px-6 py-5">
              <div><p className="section-kicker">01 / INPUT FRAME</p><h2 className="mt-1 font-display text-2xl font-semibold">Chọn ảnh để bắt đầu</h2></div>
              <ScanSearch className="text-[#de704b]" size={25} />
            </div>
            {!file ? (
              <button
                className={`drop-zone m-5 flex min-h-[350px] w-[calc(100%-2.5rem)] flex-col items-center justify-center px-8 text-center ${isDragging ? 'is-dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files[0]) }}
              >
                <div className="upload-icon"><UploadCloud size={27} strokeWidth={1.7} /></div>
                <strong className="mt-5 font-display text-xl">Kéo ảnh vào đây</strong>
                <span className="mt-2 text-sm text-[#718985]">hoặc chạm để duyệt tệp · JPG, PNG · tối đa 10 MB</span>
                <span className="mt-7 rounded-full bg-[#102b2a] px-5 py-2.5 text-sm font-semibold text-white">Chọn ảnh</span>
              </button>
            ) : (
              <div className="p-5">
                <div className="preview-frame">
                  <div className="preview-media">
                    <img src={previewUrl} alt="Ảnh đã chọn" />
                    {items.map((item, index) => {
                      const box = item.box || item.Box
                      if (!box) return null
                      const x = box.x ?? box.X ?? 0
                      const y = box.y ?? box.Y ?? 0
                      const width = box.width ?? box.Width ?? 0
                      const height = box.height ?? box.Height ?? 0
                      const label = item.label || item.Label || 'Không xác định'
                      const confidence = item.confidence ?? item.Confidence
                      return <div key={`${label}-${index}`} className={`bounding-box ${hoveredItemIndex === index ? 'is-highlighted' : ''}`} style={{ left: `${(x / MODEL_INPUT_SIZE) * 100}%`, top: `${(y / MODEL_INPUT_SIZE) * 100}%`, width: `${(width / MODEL_INPUT_SIZE) * 100}%`, height: `${(height / MODEL_INPUT_SIZE) * 100}%` }} onMouseEnter={() => setHoveredItemIndex(index)} onMouseLeave={() => setHoveredItemIndex(null)}><span>{label} · {confidencePercent(confidence)}</span></div>
                    })}
                  </div>
                  {isLoading && <div className="scanning-line" />}
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#eef4ee] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3"><FileImage size={20} className="shrink-0 text-[#de704b]" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-[#718985]">{formatBytes(file.size)}</p></div></div>
                  <button className="icon-button" onClick={clearFile} title="Xóa ảnh"><X size={18} /></button>
                </div>
              </div>
            )}
            <input ref={inputRef} className="hidden" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files[0])} />
            {error && <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl bg-[#fff0ec] px-4 py-3 text-sm text-[#a9452d]"><AlertCircle size={17} />{error}</div>}
            {file && <button className="primary-action mx-5 mb-5 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2" onClick={detectImage} disabled={isLoading}>{isLoading ? <><LoaderCircle className="animate-spin" size={19} /> Đang phân tích...</> : <><ScanSearch size={19} /> Phân tích khung hình <ArrowUpRight size={18} /></>}</button>}
          </div>

          <aside className="flex flex-col gap-5 reveal reveal-delay-2">
            <div className="stats-panel flex-1">
              <p className="section-kicker text-[#b9d6c8]">02 / SIGNAL REPORT</p>
              <div className="mt-10 flex items-end gap-3"><span className="font-display text-8xl font-semibold leading-none text-white">{result ? total : '—'}</span><span className="mb-2 text-sm text-[#b9d6c8]">vật thể<br />được thấy</span></div>
              <div className="mt-10 border-t border-white/15 pt-5 text-sm text-[#b9d6c8]">{result ? <span className="flex items-center gap-2 text-[#aee4bd]"><Check size={16} /> Phân tích hoàn tất</span> : 'Kết quả sẽ xuất hiện sau khi phân tích ảnh.'}</div>
            </div>
            <div className="panel p-6"><p className="section-kicker">03 / BREAKDOWN</p><h2 className="mt-1 font-display text-2xl font-semibold">Các vật thể tìm thấy</h2>{items.length ? <div className="mt-6 space-y-4">{items.map((item, index) => { const label = item.label || item.Label || 'Không xác định'; const confidence = item.confidence ?? item.Confidence; return <div className={`result-row ${hoveredItemIndex === index ? 'is-highlighted' : ''}`} key={`${label}-${index}`} onMouseEnter={() => setHoveredItemIndex(index)} onMouseLeave={() => setHoveredItemIndex(null)}><div className="flex min-w-0 items-center gap-3"><span className="result-index">{String(index + 1).padStart(2, '0')}</span><span className="truncate font-semibold">{label}</span></div><span className="confidence">{confidencePercent(confidence)}</span></div> })}</div> : <div className="empty-results mt-6"><ScanSearch size={21} /><span>Chưa có dữ liệu để hiển thị</span></div>}</div>
          </aside>
        </div>
      </section>
      <footer className="relative z-10 mx-auto flex max-w-7xl justify-between px-5 pb-8 text-xs text-[#78908c] lg:px-10"><span>RIVER HEALTH / FIELD TOOL</span><span>Made for clearer waters</span></footer>
    </main>
  )
}

export default App
