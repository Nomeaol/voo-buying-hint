document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const totalCapitalInput = document.getElementById('total-capital');
  const vooPriceInput = document.getElementById('voo-price');
  const reservePctInput = document.getElementById('reserve-pct');
  const reserveLabel = document.getElementById('reserve-label');
  const capitalSummary = document.getElementById('capital-summary');
  const investableAmountEl = document.getElementById('investable-amount');
  const cashReserveEl = document.getElementById('cash-reserve');
  const approxSharesEl = document.getElementById('approx-shares');

  const strategyBtns = document.querySelectorAll('.strategy-btn');
  const dcaOptions = document.getElementById('dca-options');
  const lumpOptions = document.getElementById('lump-options');
  const hybridOptions = document.getElementById('hybrid-options');

  const hybridInitialInput = document.getElementById('hybrid-initial');
  const hybridLabel = document.getElementById('hybrid-label');

  const scheduleSection = document.getElementById('schedule-section');
  const scheduleStats = document.getElementById('schedule-stats');
  const scheduleBody = document.getElementById('schedule-body');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');

  const projectionSection = document.getElementById('projection-section');
  const annualReturnInput = document.getElementById('annual-return');
  const returnLabel = document.getElementById('return-label');
  const projectionYearsInput = document.getElementById('projection-years');
  const yearsLabel = document.getElementById('years-label');
  const projectionGrid = document.getElementById('projection-grid');
  const projectionChart = document.getElementById('projection-chart');

  const fetchPriceBtn = document.getElementById('fetch-price-btn');
  const fetchStatus = document.getElementById('fetch-status');
  const weeklyChartCanvas = document.getElementById('weekly-chart');
  const chartLoading = document.getElementById('chart-loading');
  const chartLegend = document.getElementById('chart-legend');

  const generateBtn = document.getElementById('generate-btn');
  const resetBtn = document.getElementById('reset-btn');

  let currentStrategy = 'dca';
  let scheduleData = [];
  let weeklyPriceData = [];

  // Formatters
  const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // --- Fetch live quote and 52-week data on load ---
  fetchQuote();
  fetchWeeklyData();

  fetchPriceBtn.addEventListener('click', () => {
    fetchQuote();
    fetchWeeklyData();
  });

  async function fetchQuote() {
    fetchPriceBtn.disabled = true;
    fetchPriceBtn.classList.add('loading');
    fetchStatus.textContent = 'Fetching live price...';
    fetchStatus.className = 'fetch-status';

    try {
      const res = await fetch('/api/quote');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (data['Error Message']) throw new Error('Invalid API response.');
      if (data['Note']) throw new Error('API rate limit reached. Try again in a minute.');

      const quote = data['Global Quote'];
      if (!quote || !quote['05. price']) throw new Error('No price data returned. Check your API key in .env');

      const price = parseFloat(quote['05. price']);
      const change = parseFloat(quote['09. change']);
      const changePct = quote['10. change percent'] || '';
      const prevClose = quote['08. previous close'];

      vooPriceInput.value = price.toFixed(2);
      updateCapitalSummary();

      const arrow = change >= 0 ? '\u25B2' : '\u25BC';
      const sign = change >= 0 ? '+' : '';
      fetchStatus.innerHTML = `VOO: <strong>$${price.toFixed(2)}</strong> ${arrow} ${sign}${change.toFixed(2)} (${changePct}) &mdash; Prev close: $${prevClose}`;
      fetchStatus.className = `fetch-status ${change >= 0 ? 'success' : 'error'}`;
    } catch (err) {
      fetchStatus.textContent = err.message;
      fetchStatus.className = 'fetch-status error';
    } finally {
      fetchPriceBtn.disabled = false;
      fetchPriceBtn.classList.remove('loading');
    }
  }

  async function fetchWeeklyData() {
    chartLoading.classList.remove('hidden');
    weeklyChartCanvas.classList.remove('visible');

    try {
      const res = await fetch('/api/weekly');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      if (data['Error Message'] || data['Note']) {
        throw new Error(data['Note'] || data['Error Message']);
      }

      const timeSeries = data['Weekly Time Series'];
      if (!timeSeries) throw new Error('No weekly data returned.');

      // Parse and take last 52 weeks
      const entries = Object.entries(timeSeries)
        .map(([date, vals]) => ({
          date,
          close: parseFloat(vals['4. close']),
          high: parseFloat(vals['2. high']),
          low: parseFloat(vals['3. low']),
          volume: parseFloat(vals['5. volume']),
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      weeklyPriceData = entries.slice(-52);

      chartLoading.classList.add('hidden');
      weeklyChartCanvas.classList.add('visible');
      drawWeeklyChart();
    } catch (err) {
      chartLoading.textContent = 'Failed to load chart: ' + err.message;
    }
  }

  function drawWeeklyChart() {
    if (weeklyPriceData.length === 0) return;

    const canvas = weeklyChartCanvas;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = rect.width - 32; // account for padding
    const H = 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 15, bottom: 40, left: 60 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const closes = weeklyPriceData.map(d => d.close);
    const highs = weeklyPriceData.map(d => d.high);
    const lows = weeklyPriceData.map(d => d.low);
    const allVals = [...highs, ...lows];
    const minVal = Math.min(...allVals) * 0.98;
    const maxVal = Math.max(...allVals) * 1.02;

    const n = weeklyPriceData.length;
    function x(i) { return pad.left + (i / (n - 1)) * chartW; }
    function y(v) { return pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH; }

    // Grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 0.5;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const val = minVal + (maxVal - minVal) * (i / gridLines);
      const yPos = y(val);
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(W - pad.right, yPos);
      ctx.stroke();

      ctx.fillStyle = '#999';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + val.toFixed(0), pad.left - 6, yPos + 3);
    }

    // X labels (show ~6 dates)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = '10px -apple-system, sans-serif';
    const step = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += step) {
      const d = new Date(weeklyPriceData[i].date);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      ctx.fillText(label, x(i), H - pad.bottom + 16);
    }
    // Always label last point
    const lastD = new Date(weeklyPriceData[n - 1].date);
    ctx.fillText(lastD.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x(n - 1), H - pad.bottom + 16);

    // High/low range band
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(x(i), y(highs[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(lows[i]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(44, 95, 138, 0.08)';
    ctx.fill();

    // Close price area fill
    const firstClose = closes[0];
    const lastClose = closes[n - 1];
    const isUp = lastClose >= firstClose;
    const lineColor = isUp ? '#27ae60' : '#e74c3c';
    const fillColorTop = isUp ? 'rgba(39, 174, 96, 0.18)' : 'rgba(231, 76, 60, 0.18)';
    const fillColorBot = isUp ? 'rgba(39, 174, 96, 0.01)' : 'rgba(231, 76, 60, 0.01)';

    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(closes[i]));
    ctx.lineTo(x(n - 1), y(minVal));
    ctx.lineTo(x(0), y(minVal));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, fillColorTop);
    grad.addColorStop(1, fillColorBot);
    ctx.fillStyle = grad;
    ctx.fill();

    // Close price line
    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(closes[i]));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots at start and end
    [0, n - 1].forEach(i => {
      ctx.beginPath();
      ctx.arc(x(i), y(closes[i]), 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Price labels at start/end
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillStyle = lineColor;
    ctx.textAlign = 'left';
    ctx.fillText('$' + firstClose.toFixed(2), x(0) + 8, y(firstClose) - 6);
    ctx.textAlign = 'right';
    ctx.fillText('$' + lastClose.toFixed(2), x(n - 1) - 8, y(lastClose) - 6);

    // Update legend
    const change = lastClose - firstClose;
    const changePct = ((change / firstClose) * 100).toFixed(2);
    const arrow = change >= 0 ? '\u25B2' : '\u25BC';
    const sign = change >= 0 ? '+' : '';
    chartLegend.innerHTML = `
      <span class="legend-price">$${lastClose.toFixed(2)}</span>
      <span class="legend-change ${change >= 0 ? 'up' : 'down'}">${arrow} ${sign}${change.toFixed(2)} (${sign}${changePct}%) 52w</span>
    `;

    // --- Interactive hover tooltip ---
    canvas.onmousemove = (e) => {
      const bounds = canvas.getBoundingClientRect();
      const mx = e.clientX - bounds.left;
      const idx = Math.round(((mx - pad.left) / chartW) * (n - 1));
      if (idx < 0 || idx >= n) return;

      // Redraw chart then overlay crosshair
      drawWeeklyChartStatic(ctx, W, H, pad, chartW, chartH, n, closes, highs, lows, minVal, maxVal, lineColor, grad);

      const px = x(idx);
      const py = y(closes[idx]);

      // Vertical crosshair
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, H - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip
      const dp = weeklyPriceData[idx];
      const tooltipText = `${dp.date}  Close: $${dp.close.toFixed(2)}  H: $${dp.high.toFixed(2)}  L: $${dp.low.toFixed(2)}`;
      ctx.font = '11px -apple-system, sans-serif';
      const tw = ctx.measureText(tooltipText).width + 16;
      let tx = px - tw / 2;
      if (tx < pad.left) tx = pad.left;
      if (tx + tw > W - pad.right) tx = W - pad.right - tw;
      const ty = pad.top - 2;

      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.roundRect(tx, ty - 16, tw, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(tooltipText, tx + 8, ty - 1);
    };

    canvas.onmouseleave = () => {
      drawWeeklyChart();
      canvas.onmousemove = null; // reset then reattach
      setTimeout(() => { canvas.onmousemove = canvas._hoverHandler; }, 0);
    };
    canvas._hoverHandler = canvas.onmousemove;
  }

  // Static redraw helper (no event handlers) for hover overlay
  function drawWeeklyChartStatic(ctx, W, H, pad, chartW, chartH, n, closes, highs, lows, minVal, maxVal, lineColor, grad) {
    function x(i) { return pad.left + (i / (n - 1)) * chartW; }
    function y(v) { return pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH; }

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const val = minVal + (maxVal - minVal) * (i / 5);
      const yPos = y(val);
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(W - pad.right, yPos);
      ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + val.toFixed(0), pad.left - 6, yPos + 3);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = '10px -apple-system, sans-serif';
    const step = Math.max(1, Math.floor(n / 6));
    for (let i = 0; i < n; i += step) {
      const d = new Date(weeklyPriceData[i].date);
      ctx.fillText(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x(i), H - pad.bottom + 16);
    }
    const lastD = new Date(weeklyPriceData[n - 1].date);
    ctx.fillText(lastD.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), x(n - 1), H - pad.bottom + 16);

    // Range band
    ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.lineTo(x(i), y(highs[i]));
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(x(i), y(lows[i]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(44, 95, 138, 0.08)';
    ctx.fill();

    // Area fill
    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(closes[i]));
    ctx.lineTo(x(n - 1), y(minVal));
    ctx.lineTo(x(0), y(minVal));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    for (let i = 1; i < n; i++) ctx.lineTo(x(i), y(closes[i]));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Live capital summary
  function updateCapitalSummary() {
    const capital = parseFloat(totalCapitalInput.value) || 0;
    const price = parseFloat(vooPriceInput.value) || 1;
    const reservePct = parseInt(reservePctInput.value);

    if (capital > 0) {
      const reserve = capital * (reservePct / 100);
      const investable = capital - reserve;
      const shares = Math.floor(investable / price);

      investableAmountEl.textContent = fmt(investable);
      cashReserveEl.textContent = fmt(reserve);
      approxSharesEl.textContent = `~${shares} shares`;
      capitalSummary.style.display = 'block';
    } else {
      capitalSummary.style.display = 'none';
    }
  }

  reservePctInput.addEventListener('input', () => {
    reserveLabel.textContent = reservePctInput.value + '%';
    updateCapitalSummary();
  });

  totalCapitalInput.addEventListener('input', updateCapitalSummary);
  vooPriceInput.addEventListener('input', updateCapitalSummary);

  // Strategy toggle
  strategyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      strategyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStrategy = btn.dataset.strategy;

      dcaOptions.style.display = currentStrategy === 'dca' ? 'block' : 'none';
      lumpOptions.style.display = currentStrategy === 'lump' ? 'block' : 'none';
      hybridOptions.style.display = currentStrategy === 'hybrid' ? 'block' : 'none';
    });
  });

  hybridInitialInput.addEventListener('input', () => {
    hybridLabel.textContent = hybridInitialInput.value + '%';
  });

  // Generate plan
  generateBtn.addEventListener('click', generatePlan);
  resetBtn.addEventListener('click', resetAll);

  function generatePlan() {
    const capital = parseFloat(totalCapitalInput.value);
    const price = parseFloat(vooPriceInput.value);
    const reservePct = parseInt(reservePctInput.value);

    if (!capital || capital <= 0) {
      alert('Please enter your total capital.');
      totalCapitalInput.focus();
      return;
    }
    if (!price || price <= 0) {
      alert('Please wait for the VOO price to load, or enter it manually.');
      vooPriceInput.focus();
      return;
    }

    const investable = capital * (1 - reservePct / 100);
    scheduleData = [];

    const today = new Date();

    if (currentStrategy === 'lump') {
      scheduleData.push({
        date: new Date(today),
        amount: investable,
        shares: Math.floor(investable / price),
        cumulative: investable
      });
    } else if (currentStrategy === 'dca') {
      const freq = document.getElementById('dca-frequency').value;
      const months = parseInt(document.getElementById('dca-duration').value) || 12;
      const intervals = getIntervalCount(freq, months);
      const perInterval = investable / intervals;

      let cumulative = 0;
      for (let i = 0; i < intervals; i++) {
        const date = getNextDate(today, freq, i);
        cumulative += perInterval;
        scheduleData.push({
          date,
          amount: perInterval,
          shares: Math.floor(perInterval / price),
          cumulative
        });
      }
    } else if (currentStrategy === 'hybrid') {
      const initialPct = parseInt(hybridInitialInput.value);
      const lumpAmount = investable * (initialPct / 100);
      const dcaTotal = investable - lumpAmount;
      const freq = document.getElementById('hybrid-frequency').value;
      const months = parseInt(document.getElementById('hybrid-duration').value) || 6;
      const intervals = getIntervalCount(freq, months);
      const perInterval = dcaTotal / intervals;

      let cumulative = lumpAmount;
      scheduleData.push({
        date: new Date(today),
        amount: lumpAmount,
        shares: Math.floor(lumpAmount / price),
        cumulative,
        isLump: true
      });

      for (let i = 0; i < intervals; i++) {
        const date = getNextDate(today, freq, i + 1);
        cumulative += perInterval;
        scheduleData.push({
          date,
          amount: perInterval,
          shares: Math.floor(perInterval / price),
          cumulative
        });
      }
    }

    renderSchedule(investable, price);
    renderProjection(investable);
    scheduleSection.style.display = 'block';
    projectionSection.style.display = 'block';
    scheduleSection.scrollIntoView({ behavior: 'smooth' });
  }

  function getIntervalCount(freq, months) {
    if (freq === 'weekly') return months * 4;
    if (freq === 'biweekly') return months * 2;
    return months;
  }

  function getNextDate(start, freq, index) {
    const d = new Date(start);
    if (freq === 'weekly') d.setDate(d.getDate() + index * 7);
    else if (freq === 'biweekly') d.setDate(d.getDate() + index * 14);
    else d.setMonth(d.getMonth() + index);
    return d;
  }

  function renderSchedule(investable, price) {
    const totalShares = scheduleData.reduce((sum, r) => sum + r.shares, 0);

    scheduleStats.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${fmt(investable)}</div>
        <div class="stat-label">Total to Invest</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${scheduleData.length}</div>
        <div class="stat-label">Transactions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">~${totalShares}</div>
        <div class="stat-label">Est. Total Shares</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${fmt(scheduleData.length > 0 ? scheduleData[0].amount : 0)}</div>
        <div class="stat-label">${currentStrategy === 'lump' ? 'One-Time' : 'Per Transaction'}</div>
      </div>
    `;

    scheduleBody.innerHTML = '';
    const now = new Date();

    scheduleData.forEach((row, i) => {
      const isPast = row.date <= now;
      const isNext = !isPast && (i === 0 || scheduleData[i - 1].date <= now);

      const tr = document.createElement('tr');
      if (isPast) tr.classList.add('completed');

      let statusClass = 'pending';
      let statusText = 'Pending';
      if (isPast) { statusClass = 'done'; statusText = 'Done'; }
      else if (isNext) { statusClass = 'next'; statusText = 'Next'; }

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${row.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${row.isLump ? ' (Lump)' : ''}</td>
        <td>${fmt(row.amount)}</td>
        <td>~${row.shares}</td>
        <td>${fmt(row.cumulative)}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      `;
      scheduleBody.appendChild(tr);
    });

    // Progress
    const completedCount = scheduleData.filter(r => r.date <= now).length;
    const pct = scheduleData.length > 0 ? Math.round((completedCount / scheduleData.length) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressLabel.textContent = `${pct}% complete (${completedCount}/${scheduleData.length})`;
  }

  // Projection
  annualReturnInput.addEventListener('input', () => {
    returnLabel.textContent = annualReturnInput.value + '%';
    if (scheduleData.length > 0) renderProjection();
  });

  projectionYearsInput.addEventListener('input', () => {
    yearsLabel.textContent = projectionYearsInput.value + ' years';
    if (scheduleData.length > 0) renderProjection();
  });

  function renderProjection(investableOverride) {
    const investable = investableOverride || scheduleData[scheduleData.length - 1].cumulative;
    const annualReturn = parseFloat(annualReturnInput.value) / 100;
    const years = parseInt(projectionYearsInput.value);

    const projections = [];
    for (let y = 0; y <= years; y++) {
      const value = investable * Math.pow(1 + annualReturn, y);
      projections.push({ year: y, value });
    }

    const finalValue = projections[projections.length - 1].value;
    const totalGain = finalValue - investable;
    const totalReturnPct = ((finalValue / investable - 1) * 100).toFixed(1);

    projectionGrid.innerHTML = `
      <div class="projection-card">
        <div class="proj-label">Initial Investment</div>
        <div class="proj-value">${fmtInt(investable)}</div>
      </div>
      <div class="projection-card">
        <div class="proj-label">Projected Value (${years}yr)</div>
        <div class="proj-value gain">${fmtInt(finalValue)}</div>
      </div>
      <div class="projection-card">
        <div class="proj-label">Total Gain</div>
        <div class="proj-value gain">${fmtInt(totalGain)}</div>
      </div>
      <div class="projection-card">
        <div class="proj-label">Total Return</div>
        <div class="proj-value gain">${totalReturnPct}%</div>
      </div>
    `;

    drawProjectionChart(projections, investable);
  }

  function drawProjectionChart(projections, investable) {
    const canvas = projectionChart;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = 300;
    const pad = { top: 30, right: 20, bottom: 40, left: 70 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    const maxVal = projections[projections.length - 1].value * 1.1;
    const minVal = 0;

    function x(i) { return pad.left + (i / (projections.length - 1)) * chartW; }
    function y(v) { return pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH; }

    // Grid
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const val = minVal + (maxVal - minVal) * (i / gridLines);
      const yPos = y(val);
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(W - pad.right, yPos);
      ctx.stroke();

      ctx.fillStyle = '#999';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(fmtInt(val), pad.left - 8, yPos + 4);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    projections.forEach((p, i) => {
      if (i % Math.ceil(projections.length / 10) === 0 || i === projections.length - 1) {
        ctx.fillText('Yr ' + p.year, x(i), H - pad.bottom + 20);
      }
    });

    // Invested baseline
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, y(investable));
    ctx.lineTo(W - pad.right, y(investable));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#bdc3c7';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Invested', W - pad.right - 50, y(investable) - 6);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(x(0), y(projections[0].value));
    projections.forEach((p, i) => ctx.lineTo(x(i), y(p.value)));
    ctx.lineTo(x(projections.length - 1), y(0));
    ctx.lineTo(x(0), y(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    grad.addColorStop(0, 'rgba(39, 174, 96, 0.25)');
    grad.addColorStop(1, 'rgba(39, 174, 96, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(x(0), y(projections[0].value));
    projections.forEach((p, i) => ctx.lineTo(x(i), y(p.value)));
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots at start and end
    [0, projections.length - 1].forEach(i => {
      ctx.beginPath();
      ctx.arc(x(i), y(projections[i].value), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#27ae60';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // End value label
    const last = projections[projections.length - 1];
    ctx.fillStyle = '#27ae60';
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtInt(last.value), x(projections.length - 1) - 5, y(last.value) - 12);
  }

  function resetAll() {
    totalCapitalInput.value = '';
    vooPriceInput.value = '';
    reservePctInput.value = 10;
    reserveLabel.textContent = '10%';
    capitalSummary.style.display = 'none';
    scheduleSection.style.display = 'none';
    projectionSection.style.display = 'none';
    scheduleData = [];
    strategyBtns.forEach(b => b.classList.remove('active'));
    strategyBtns[0].classList.add('active');
    currentStrategy = 'dca';
    dcaOptions.style.display = 'block';
    lumpOptions.style.display = 'none';
    hybridOptions.style.display = 'none';
    fetchQuote();
    fetchWeeklyData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle window resize for charts
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (weeklyPriceData.length > 0) drawWeeklyChart();
      if (scheduleData.length > 0) renderProjection();
    }, 200);
  });
});
