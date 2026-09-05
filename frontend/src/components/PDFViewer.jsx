import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
    ZoomIn, ZoomOut, RotateCcw, Download, 
    ChevronLeft, ChevronRight, Maximize2, Minimize2,
    Loader2, AlertCircle, FileText
} from 'lucide-react';

// Configure PDF.js worker
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();
} catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const PDFViewer = ({ pdfData, fileName = 'Applicant_Resume.pdf', className = '' }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    
    const [pdfDoc, setPdfDoc] = useState(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.15);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Convert base64 / blob / data url to Uint8Array
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setPageNum(1);

        const loadPdf = async () => {
            try {
                let bytes;
                if (typeof pdfData === 'string') {
                    const cleanBase64 = pdfData.replace(/^data:application\/pdf;base64,/, '').trim();
                    const binaryString = atob(cleanBase64);
                    const len = binaryString.length;
                    bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                } else if (pdfData instanceof Uint8Array) {
                    bytes = pdfData;
                } else if (pdfData instanceof ArrayBuffer) {
                    bytes = new Uint8Array(pdfData);
                } else {
                    throw new Error('Unsupported PDF data format');
                }

                const loadingTask = pdfjsLib.getDocument({ data: bytes });
                const doc = await loadingTask.promise;
                if (isMounted) {
                    setPdfDoc(doc);
                    setNumPages(doc.numPages);
                    setLoading(false);
                }
            } catch (err) {
                console.error('PDF.js render error:', err);
                if (isMounted) {
                    setError('Failed to load PDF document. Please try downloading it directly.');
                    setLoading(false);
                }
            }
        };

        if (pdfData) {
            loadPdf();
        } else {
            setLoading(false);
            setError('No PDF data provided');
        }

        return () => {
            isMounted = false;
        };
    }, [pdfData]);

    // Render current page onto canvas
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;
        let renderTask = null;

        const renderPage = async () => {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const canvas = canvasRef.current;
                if (!canvas) return;

                const context = canvas.getContext('2d');
                const pixelRatio = window.devicePixelRatio || 1.5;
                const viewport = page.getViewport({ scale: scale * pixelRatio });

                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.width = `${viewport.width / pixelRatio}px`;
                canvas.style.height = `${viewport.height / pixelRatio}px`;

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                };

                renderTask = page.render(renderContext);
                await renderTask.promise;
            } catch (err) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error('Page render error:', err);
                }
            }
        };

        renderPage();

        return () => {
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pdfDoc, pageNum, scale]);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 2.5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.6));
    const handleResetZoom = () => setScale(1.15);

    const handlePrevPage = () => setPageNum(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setPageNum(prev => Math.min(prev + 1, numPages));

    const handleDownload = () => {
        if (!pdfData) return;
        const cleanBase64 = typeof pdfData === 'string' 
            ? pdfData.replace(/^data:application\/pdf;base64,/, '').trim()
            : '';
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${cleanBase64}`;
        link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`flex flex-col bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative select-none ${className}`}
        >
            {/* Top Toolbar */}
            <div className="bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-10 text-white">
                <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300 truncate max-w-[150px] sm:max-w-[220px]">
                        {fileName}
                    </span>
                    {numPages > 1 && (
                        <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700">
                            {numPages} Pages
                        </span>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Page Navigation */}
                    {numPages > 1 && (
                        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 mr-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={pageNum <= 1}
                                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Previous Page"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-[11px] font-bold px-2 text-slate-300">
                                {pageNum} / {numPages}
                            </span>
                            <button
                                onClick={handleNextPage}
                                disabled={pageNum >= numPages}
                                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                title="Next Page"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                        <button
                            onClick={handleZoomOut}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut size={15} />
                        </button>
                        <button
                            onClick={handleResetZoom}
                            className="px-2 py-1 text-[10px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Reset Zoom"
                        >
                            {Math.round(scale * 100)}%
                        </button>
                        <button
                            onClick={handleZoomIn}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn size={15} />
                        </button>
                    </div>

                    {/* Download Button */}
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-blue-900/40"
                        title="Download PDF"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline">Download</span>
                    </button>

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-colors"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                </div>
            </div>

            {/* Canvas Viewer Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-slate-900/90 min-h-[450px] relative">
                {loading && (
                    <div className="flex flex-col items-center gap-3 text-slate-400 py-16">
                        <Loader2 size={32} className="animate-spin text-blue-500" />
                        <p className="text-xs font-bold uppercase tracking-wider">Rendering High-Definition Document...</p>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center gap-3 text-center p-8 max-w-md bg-slate-800/80 rounded-2xl border border-slate-700">
                        <AlertCircle size={36} className="text-amber-400" />
                        <p className="text-sm font-bold text-slate-200">{error}</p>
                        <button
                            onClick={handleDownload}
                            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                            Download Raw PDF File
                        </button>
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    className={`rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white transition-transform duration-100 ${loading || error ? 'hidden' : 'block'}`}
                />
            </div>
        </div>
    );
};

export default PDFViewer;
