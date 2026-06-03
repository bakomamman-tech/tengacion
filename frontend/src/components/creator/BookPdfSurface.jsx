import { useEffect, useMemo, useRef, useState } from "react";

import "./BookPdfSurface.css";

let pdfjsLoader = null;

const loadPdfjs = () => {
  if (!pdfjsLoader) {
    pdfjsLoader = import("pdfjs-dist").then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).toString();
      return module;
    });
  }
  return pdfjsLoader;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 1.08;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function PdfCanvasPage({ pdfDocument, pageNumber, containerWidth, zoom, title }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [renderState, setRenderState] = useState("idle");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdfDocument || !canvas || !containerWidth) {
      return undefined;
    }

    let cancelled = false;
    renderTaskRef.current?.cancel?.();
    setRenderState("loading");

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const unscaledViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(280, containerWidth - 28);
        const fitScale = availableWidth / unscaledViewport.width;
        const scale = clamp(fitScale * zoom, 0.4, 3);
        const viewport = page.getViewport({ scale });
        const outputScale = clamp(window.devicePixelRatio || 1, 1, 2);
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) {
          throw new Error("Canvas rendering is unavailable.");
        }

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        canvasContext.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        canvasContext.clearRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
          canvasContext,
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (!cancelled) {
          setRenderState("ready");
        }
      } catch (error) {
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          setRenderState("error");
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [containerWidth, pageNumber, pdfDocument, zoom]);

  return (
    <div className="book-pdf-surface__page">
      {renderState === "loading" ? (
        <div className="book-pdf-surface__page-status">Rendering page...</div>
      ) : null}
      {renderState === "error" ? (
        <div className="book-pdf-surface__page-status book-pdf-surface__page-status--error">
          Could not render this page.
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="book-pdf-surface__canvas"
        aria-label={`${title} page ${pageNumber}`}
      />
    </div>
  );
}

export default function BookPdfSurface({
  src = "",
  title = "Book PDF",
  mode = "preview",
  className = "",
  caption = "",
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [loadState, setLoadState] = useState("idle");
  const [loadError, setLoadError] = useState("");
  const sourceUrl = String(src || "").trim();
  const label = mode === "full" ? "Full book reader" : "Book preview reader";
  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
  const canGoBack = pageNumber > 1;
  const canGoForward = pageCount > 0 && pageNumber < pageCount;
  const hasDocument = Boolean(pdfDocument && pageCount);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateWidth = () => {
      setContainerWidth(Math.floor(element.getBoundingClientRect().width || 0));
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPdfDocument(null);
    setPageCount(0);
    setPageNumber(1);
    setZoom(DEFAULT_ZOOM);
    setLoadError("");

    if (!sourceUrl) {
      setLoadState("idle");
      return undefined;
    }

    let cancelled = false;
    let loadingTask = null;
    setLoadState("loading");

    loadPdfjs()
      .then((pdfjsLib) => {
        if (cancelled) {
          return null;
        }

        loadingTask = pdfjsLib.getDocument({
          url: sourceUrl,
          withCredentials: false,
        });
        return loadingTask.promise;
      })
      .then((document) => {
        if (!document) {
          return;
        }

        if (cancelled) {
          document.destroy();
          return;
        }
        setPdfDocument(document);
        setPageCount(document.numPages || 0);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error?.message || "Could not load this PDF.");
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [sourceUrl]);

  const goToPreviousPage = () => {
    setPageNumber((current) => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPageNumber((current) => Math.min(pageCount || current, current + 1));
  };

  const zoomOut = () => {
    setZoom((current) => clamp(Number((current - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  };

  const zoomIn = () => {
    setZoom((current) => clamp(Number((current + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  };

  const resetZoom = () => {
    setZoom(DEFAULT_ZOOM);
  };

  return (
    <div
      ref={containerRef}
      className={`book-pdf-surface${className ? ` ${className}` : ""}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="book-pdf-surface__head">
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </div>

      {hasDocument ? (
        <div className="book-pdf-surface__toolbar" aria-label={`${title} PDF controls`}>
          <button type="button" onClick={goToPreviousPage} disabled={!canGoBack}>
            Previous
          </button>
          <strong>
            Page {pageNumber} of {pageCount}
          </strong>
          <button type="button" onClick={goToNextPage} disabled={!canGoForward}>
            Next
          </button>
          <div className="book-pdf-surface__zoom">
            <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
              -
            </button>
            <button type="button" onClick={resetZoom}>
              {zoomLabel}
            </button>
            <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
              +
            </button>
          </div>
        </div>
      ) : null}

      {!sourceUrl ? (
        <div className="book-pdf-surface__empty">
          PDF reader unavailable for this book.
        </div>
      ) : loadState === "loading" ? (
        <div className="book-pdf-surface__empty">
          Loading PDF reader...
        </div>
      ) : loadState === "error" ? (
        <div className="book-pdf-surface__empty book-pdf-surface__empty--error">
          {loadError || "Could not load this PDF."}
        </div>
      ) : hasDocument ? (
        <PdfCanvasPage
          pdfDocument={pdfDocument}
          pageNumber={pageNumber}
          containerWidth={containerWidth}
          zoom={zoom}
          title={title}
        />
      ) : (
        <div className="book-pdf-surface__empty">
          PDF reader unavailable for this book.
        </div>
      )}
    </div>
  );
}
