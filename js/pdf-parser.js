// PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

async function extractPDFText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

const MONTHS = {
  january:'01', february:'02', march:'03', april:'04',
  may:'05', june:'06', july:'07', august:'08',
  september:'09', october:'10', november:'11', december:'12'
};

function airbnbDateToISO(str) {
  const m = str.trim().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
}

function parseAirbnbPDF(text) {
  // Period: "1 April 2026 – 30 April 2026"
  const periodRe = /(\d{1,2}\s+\w+\s+\d{4})\s*[–\-]\s*(\d{1,2}\s+\w+\s+\d{4})/;
  const periodMatch = text.match(periodRe);

  // All AUD amounts in order: gross, adjustments, service fees, tax withheld, total
  const amountRe = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*AUD/g;
  const amounts = [];
  let m;
  while ((m = amountRe.exec(text)) !== null) {
    amounts.push(parseFloat(m[1].replace(/,/g, '')));
  }

  const nightsMatch = text.match(/Nights booked\s*(\d+)/);
  const avgMatch = text.match(/Avg night stay\s*([\d.]+)/);

  return {
    period_start: periodMatch ? airbnbDateToISO(periodMatch[1]) : null,
    period_end:   periodMatch ? airbnbDateToISO(periodMatch[2]) : null,
    gross_earnings: amounts[0] ?? 0,
    adjustments:    amounts[1] ?? 0,
    service_fees:   amounts[2] ?? 0,
    tax_withheld:   amounts[3] ?? 0,
    total:          amounts[4] ?? 0,
    nights_booked:  nightsMatch ? parseInt(nightsMatch[1]) : 0,
    avg_night_stay: avgMatch    ? parseFloat(avgMatch[1])  : 0
  };
}

function parseExpensePDF(text) {
  // Try to find a date
  let date = null;
  const datePatterns = [
    { re: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, fn: m => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    { re: /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i, fn: m => `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}` },
    { re: /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/, fn: m => `${m[1]}-${m[2]}-${m[3]}` }
  ];
  for (const { re, fn } of datePatterns) {
    const m = text.match(re);
    if (m) { date = fn(m); break; }
  }

  // Try to find total amount — look for "Total", "Amount Due", etc. then a $ figure
  let amount = null;
  const totalRe = /(?:total|amount due|invoice total|balance due|amount payable)[^\d$]*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
  const totalMatch = text.match(totalRe);
  if (totalMatch) {
    amount = parseFloat(totalMatch[1].replace(/,/g, ''));
  } else {
    // Fall back to largest dollar amount in document
    const allAmounts = [];
    const amtRe = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;
    let am;
    while ((am = amtRe.exec(text)) !== null) {
      allAmounts.push(parseFloat(am[1].replace(/,/g, '')));
    }
    if (allAmounts.length) amount = Math.max(...allAmounts);
  }

  // Vendor: first non-empty line that looks like a business name
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 80);
  const vendor = lines[0] || '';

  return { date, amount, vendor };
}
