import { PaperTrade, PaperAccount } from '../types/crypto';
import { formatPrice } from './formatters';

/**
 * Exports closed and active paper trades to a CSV file with Arabic UTF-8 BOM support
 */
export function exportTradesToCSV(trades: PaperTrade[], onError?: (msg: string) => void) {
  if (!trades || trades.length === 0) {
    if (onError) onError('لا توجد صفقات لتصديرها.');
    return;
  }

  const headers = [
    'معرف الصفقة',
    'التاريخ والوقت',
    'الرمز',
    'الاتجاه',
    'النمط الفني',
    'الفريم',
    'الحالة',
    'سعر الدخول',
    'سعر الخروج',
    'وقف الخسارة',
    'الهدف 1',
    'الهدف 2',
    'الهدف 3',
    'الرافعة',
    'الهامش (USDT)',
    'حجم الصفقة (USDT)',
    'العمولة (USDT)',
    'الانزلاق (USDT)',
    'الربح/الخسارة الصافي (USDT)',
    'النسبة المئوية %',
    'مضاعف R',
    'سبب الإغلاق',
  ];

  const rows = trades.map((t) => [
    t.id,
    new Date(t.createdAt).toLocaleString('ar-SA'),
    t.symbol,
    t.side === 'LONG' ? 'شراء (Long)' : 'بيع (Short)',
    t.patternNameArabic,
    t.timeframe,
    t.status,
    formatPrice(t.actualEntryPrice || t.entryPrice),
    t.exitPrice ? formatPrice(t.exitPrice) : 'مفتوحة',
    formatPrice(t.stopLoss),
    formatPrice(t.tp1),
    formatPrice(t.tp2),
    t.tp3 ? formatPrice(t.tp3) : '—',
    `${t.leverage}x`,
    t.margin,
    t.positionSize,
    t.commissionPaid,
    t.slippagePaid,
    t.netPnl,
    `${t.pnlPercent}%`,
    t.rMultiple,
    t.closeReason || '—',
  ]);

  // Include UTF-8 BOM for Arabic text in Excel
  const bom = '\uFEFF';
  const csvContent =
    bom +
    [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
      '\r\n'
    );

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crypto_paper_trades_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an executive Printable / PDF-ready Weekly Performance Report
 */
export function exportWeeklyPDFReport(
  account: PaperAccount,
  trades: PaperTrade[],
  stats: {
    winRate: number;
    profitFactor: number;
    avgR: number;
    netPnl: number;
    maxDrawdown: number;
  }
) {
  const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (!printWindow) {
    return;
  }

  const closedTrades = trades.filter((t) => t.status === 'CLOSED');

  const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير الأداء الأسبوعي - Crypto Signals Pro</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      margin: 0;
      padding: 30px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 15px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #0369a1;
      margin: 0;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      background: #f8fafc;
      text-align: center;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }
    .stat-val.positive { color: #16a34a; }
    .stat-val.negative { color: #dc2626; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: right;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
    }
    tr:nth-child(even) { background: #f8fafc; }
    .footer {
      margin-top: 35px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">تقرير الأداء الأسبوعي المالي (Weekly Trading Report)</h1>
      <div class="subtitle">منصة Crypto Signals Pro • تم الاستخراج: ${new Date().toLocaleDateString('ar-SA')}</div>
    </div>
    <div style="text-align: left;">
      <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 8px; font-family: Cairo; font-weight: bold; cursor: pointer;">طباعة أو حفظ PDF</button>
    </div>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="stat-label">رأس المال الحالي (Equity)</div>
      <div class="stat-val ${account.equity >= 100 ? 'positive' : 'negative'}">${account.equity.toFixed(2)} USDT</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">نسبة النجاح (Win Rate)</div>
      <div class="stat-val positive">${stats.winRate}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">عامل الربحية (Profit Factor)</div>
      <div class="stat-val positive">${stats.profitFactor}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">متوسط مضاعف R</div>
      <div class="stat-val">${stats.avgR}R</div>
    </div>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="stat-label">صافي الأرباح (Net PnL)</div>
      <div class="stat-val ${stats.netPnl >= 0 ? 'positive' : 'negative'}">${stats.netPnl >= 0 ? `+${stats.netPnl.toFixed(2)}` : stats.netPnl.toFixed(2)} USDT</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">أقصى تراجع (Max Drawdown)</div>
      <div class="stat-val negative">${stats.maxDrawdown}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">إجمالي الصفقات</div>
      <div class="stat-val">${trades.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">الصفقات المغلقة</div>
      <div class="stat-val">${closedTrades.length}</div>
    </div>
  </div>

  <h3 style="font-size: 15px; margin-top: 25px; margin-bottom: 8px; color: #0369a1;">سجل الصفقات المنفذة والمغلقة</h3>
  <table>
    <thead>
      <tr>
        <th>الرمز</th>
        <th>الاتجاه</th>
        <th>النمط</th>
        <th>الفريم</th>
        <th>الدخول</th>
        <th>الخروج</th>
        <th>الربح/الخسارة</th>
        <th>مضاعف R</th>
        <th>السبب</th>
      </tr>
    </thead>
    <tbody>
      ${
        closedTrades.length > 0
          ? closedTrades
              .map(
                (t) => `
        <tr>
          <td><b>${t.symbol}</b></td>
          <td style="color: ${t.side === 'LONG' ? '#16a34a' : '#dc2626'}">${t.side}</td>
          <td>${t.patternNameArabic}</td>
          <td>${t.timeframe}</td>
          <td>${formatPrice(t.actualEntryPrice || t.entryPrice)}</td>
          <td>${formatPrice(t.exitPrice || 0)}</td>
          <td style="font-weight: bold; color: ${t.netPnl >= 0 ? '#16a34a' : '#dc2626'}">${t.netPnl >= 0 ? `+${t.netPnl}` : t.netPnl} USDT (${t.pnlPercent}%)</td>
          <td>1:${t.rMultiple}</td>
          <td>${t.closeReason || '—'}</td>
        </tr>
      `
              )
              .join('')
          : '<tr><td colspan="9" style="text-align: center;">لا توجد صفقات مغلقة حتى الآن</td></tr>'
      }
    </tbody>
  </table>

  <div class="footer">
    تقرير آلي صادر من نظام Paper Trading الاحترافي لمنصة Crypto Signals Pro • الرافعة المالية المستخدمة 100x بهامش 0.5 USDT • شامل العمولات والانزلاق السعري
  </div>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
