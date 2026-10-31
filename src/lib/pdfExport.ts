import jsPDF from 'jspdf';

export interface ExportPdfOptions {
  title?: string;
  reportText: string;
  imageDataUrl?: string | null;
  targetArea?: string;
  confidence?: string;
  damping?: string;
  status?: string;
}

/**
 * Strips raw markdown tokens using regex for clean plain-text/PDF output
 */
export function stripMarkdownTokens(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '') // remove heading hashes
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold asterisks
    .replace(/\*(.*?)\*/g, '$1') // remove italic asterisks
    .replace(/`([^`]+)`/g, '$1') // remove code ticks
    .replace(/^[-*•]\s+/gm, '• '); // normalize bullets
}

export function exportForensicReportPdf({
  title = 'MARITIME FORENSIC INTELLIGENCE DOSSIER',
  reportText,
  imageDataUrl,
  targetArea = 'Singapore Strait TSS (1°15\'00"N 103°48\'00"E)',
  confidence = '83.0% Certainty',
  damping = '-22.4 dB Attenuation',
  status = 'CRITICAL RADAR ANOMALY CONFIRMED',
}: ExportPdfOptions) {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // Helper for adding new page with header
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 50) {
      doc.addPage();
      y = margin + 20;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text('SAGARDRISHTI MARITIME INTELLIGENCE SYSTEM', margin, margin);
    doc.setFont('helvetica', 'normal');
    doc.text(timestamp, pageWidth - margin, margin, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 5, pageWidth - margin, margin + 5);
  };

  // --- TOP COVER BANNER ---
  drawPageHeader();
  y += 25;

  // Title block
  doc.setFillColor(7, 13, 20); // Deep navy background banner
  doc.roundedRect(margin, y, contentWidth, 54, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(95, 227, 138); // Emerald accent
  doc.text(title, margin + 14, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(
    `RADAR SENSOR: S-1A C-BAND SAR  •  AI: GEMMA 4 VISION + U-NET++  •  CORRIDOR: ${targetArea}`,
    margin + 14,
    y + 40
  );
  y += 68;

  // Incident Classification Strip
  doc.setFillColor(254, 242, 242); // Soft red background
  doc.setDrawColor(248, 113, 113); // Red border
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(185, 28, 28); // Dark red
  doc.text(`[ALERT] ${status}`, margin + 12, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Confidence: ${confidence}   |   Damping Index: ${damping}`, margin + 12, y + 26);
  y += 44;

  // Embed SAR Image if available
  if (imageDataUrl && typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image')) {
    try {
      checkPageBreak(170);
      const imgWidth = 220;
      const imgHeight = 140;
      const imgX = (pageWidth - imgWidth) / 2;

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.roundedRect(imgX - 2, y - 2, imgWidth + 4, imgHeight + 4, 2, 2, 'S');
      doc.addImage(imageDataUrl, 'JPEG', imgX, y, imgWidth, imgHeight);

      y += imgHeight + 8;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'Figure 1: Calibrated Sentinel-1 SAR Backscatter (vv polarization) showing dark capillary damping patch',
        pageWidth / 2,
        y,
        { align: 'center' }
      );
      y += 18;
    } catch {
      // Continue without image if format not accepted by jsPDF
    }
  }

  // --- REPORT BODY RENDERING ---
  const lines = reportText.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      y += 6;
      continue;
    }

    // Header 1/2/3 using regex
    const headerMatch = rawLine.match(/^(#{1,6})\s*(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      // Use regex to strip any bold asterisks wrapping the heading
      const headingText = headerMatch[2].replace(/^\*\*(.*?)\*\*$/, '$1').replace(/\*\*/g, '');

      checkPageBreak(30);
      y += 8;

      if (level <= 2) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.text(headingText, margin, y);
        y += 4;
        doc.setDrawColor(95, 227, 138);
        doc.setLineWidth(1.5);
        doc.line(margin, y, margin + 120, y);
        y += 12;
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(13, 148, 136); // Teal-600
        doc.text(headingText, margin, y);
        y += 14;
      }
      continue;
    }

    // Horizontal divider using regex
    if (/^[-—_]{2,}\s*$/.test(rawLine)) {
      checkPageBreak(12);
      y += 4;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;
      continue;
    }

    // Key-Value line using regex: e.g. **STATUS:** URGENT or STATUS: ...
    const kvMatch = rawLine.match(/^(\*\*[^*:]+?:\*\*|[A-Z0-9\s_-]+:)\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
      const value = kvMatch[2].replace(/\*\*/g, '').trim();

      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85); // Slate-700
      doc.text(`${key}: `, margin, y);

      const keyWidth = doc.getTextWidth(`${key}: `);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);

      const wrappedVal = doc.splitTextToSize(value, contentWidth - keyWidth);
      doc.text(wrappedVal, margin + keyWidth, y);
      y += Math.max(14, wrappedVal.length * 12);
      continue;
    }

    // Bullet points using regex
    const bulletMatch = rawLine.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const bulletText = bulletMatch[1].replace(/\*\*(.*?)\*\*/g, '$1');
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 148, 136);
      doc.text('•', margin + 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const wrapped = doc.splitTextToSize(bulletText, contentWidth - 20);
      doc.text(wrapped, margin + 18, y);
      y += wrapped.length * 12 + 3;
      continue;
    }

    // Numbered list items using regex
    const numberedMatch = rawLine.match(/^(\d+[\.\)])\s+(.*)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const text = numberedMatch[2].replace(/\*\*(.*?)\*\*/g, '$1');
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 148, 136);
      doc.text(num, margin + 6, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const wrapped = doc.splitTextToSize(text, contentWidth - 24);
      doc.text(wrapped, margin + 22, y);
      y += wrapped.length * 12 + 3;
      continue;
    }

    // Regular paragraph: strip markdown asterisks and backticks via regex
    const cleanParagraph = rawLine.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const wrappedParagraph = doc.splitTextToSize(cleanParagraph, contentWidth);
    checkPageBreak(wrappedParagraph.length * 11 + 6);
    doc.text(wrappedParagraph, margin, y);
    y += wrappedParagraph.length * 11 + 6;
  }

  // --- FOOTERS ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.text(
      'SAGARDRISHTI MARITIME INTELLIGENCE // MARPOL ANNEX I FORENSIC VERIFICATION',
      margin,
      pageHeight - 18
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }

  // Download PDF file
  const fileName = `SagarDrishti_Forensic_Report_${Date.now()}.pdf`;
  doc.save(fileName);
}
