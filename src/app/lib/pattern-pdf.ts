import { jsPDF } from "jspdf";

/**
 * Print-at-scale PDF tiling for FreeSewing patterns. The SVG's coordinate
 * space is millimetres, so each PDF page is produced by CROPPING the SVG's
 * viewBox to that page's window and rasterising just that tile — crisp at any
 * pattern size, with no giant intermediate canvas. Pages carry an overlap
 * band, glue guides, row/column labels, and a 5 cm scale check so a tailor
 * can confirm the printer didn't shrink anything.
 */

const MARGIN_MM = 10;
const OVERLAP_MM = 10;
const PX_PER_MM = 8; // ~200 dpi — clean pattern lines without huge tiles

export type PageFormat = "a4" | "letter";
const PAGE_MM: Record<PageFormat, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
};

function svgDimensionsMm(root: SVGSVGElement): { x: number; y: number; w: number; h: number } {
  const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0) {
    return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  }
  const w = parseFloat(root.getAttribute("width") ?? "");
  const h = parseFloat(root.getAttribute("height") ?? "");
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { x: 0, y: 0, w, h };
  throw new Error("The pattern has no printable dimensions.");
}

async function rasteriseTile(
  doc: Document,
  window_: { x: number; y: number; w: number; h: number },
): Promise<HTMLCanvasElement> {
  const clone = doc.documentElement.cloneNode(true) as unknown as SVGSVGElement;
  clone.setAttribute("viewBox", `${window_.x} ${window_.y} ${window_.w} ${window_.h}`);
  clone.setAttribute("width", `${window_.w}mm`);
  clone.setAttribute("height", `${window_.h}mm`);
  clone.setAttribute("preserveAspectRatio", "xMinYMin slice");
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't rasterise the pattern."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(window_.w * PX_PER_MM);
    canvas.height = Math.ceil(window_.h * PX_PER_MM);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Build and save a tiled, true-scale PDF of a FreeSewing pattern SVG. */
export async function downloadTiledPdf(svg: string, filename: string, format: PageFormat = "a4"): Promise<void> {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("Couldn't read the pattern.");
  const dims = svgDimensionsMm(doc.documentElement as unknown as SVGSVGElement);

  const page = PAGE_MM[format];
  const printW = page.w - MARGIN_MM * 2;
  const printH = page.h - MARGIN_MM * 2;
  const stepW = printW - OVERLAP_MM;
  const stepH = printH - OVERLAP_MM;
  const cols = Math.max(1, Math.ceil((dims.w - OVERLAP_MM) / stepW));
  const rows = Math.max(1, Math.ceil((dims.h - OVERLAP_MM) / stepH));

  const pdf = new jsPDF({ unit: "mm", format });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r > 0 || c > 0) pdf.addPage();
      const tile = await rasteriseTile(doc, {
        x: dims.x + c * stepW,
        y: dims.y + r * stepH,
        w: printW,
        h: printH,
      });
      pdf.addImage(tile.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN_MM, MARGIN_MM, printW, printH);

      // Glue guides where the next page overlaps this one.
      pdf.setDrawColor(160);
      pdf.setLineDashPattern([2, 2], 0);
      if (c < cols - 1) pdf.line(MARGIN_MM + stepW, MARGIN_MM, MARGIN_MM + stepW, MARGIN_MM + printH);
      if (r < rows - 1) pdf.line(MARGIN_MM, MARGIN_MM + stepH, MARGIN_MM + printW, MARGIN_MM + stepH);
      pdf.setLineDashPattern([], 0);

      // Scale check + page label.
      pdf.setDrawColor(40);
      pdf.line(MARGIN_MM, page.h - 6, MARGIN_MM + 50, page.h - 6);
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text("5 cm — check this before cutting", MARGIN_MM + 52, page.h - 5);
      pdf.text(
        `${filename} · page ${r * cols + c + 1}/${rows * cols} (row ${r + 1}, col ${c + 1}) · print at 100% / actual size`,
        page.w - MARGIN_MM,
        page.h - 5,
        { align: "right" },
      );
    }
  }
  pdf.save(`${filename}.pdf`);
}
