const BUCKET_BASE = 'https://storage.googleapis.com/musa5090s26-team3-public';
const MAX_VALUE = 1000000;

document.addEventListener('DOMContentLoaded', async () => {
  // --- 1. Initialize Map ---
  const mapContainer = document.getElementById('map-container');
  mapContainer.innerHTML = '';

  const map = L.map('map-container').setView([39.9526, -75.1652], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
  }).addTo(map);

  // --- 2. Property Vector Tiles ---
  function getValueColor(value) {
    if (!value || value <= 0) return '#e2e8f0';
    if (value < 50000) return '#fff7ed';
    if (value < 100000) return '#fdba74';
    if (value < 200000) return '#f97316';
    if (value < 350000) return '#ea580c';
    if (value < 600000) return '#c2410c';
    return '#7c2d12';
  }

  const tileUrl = 'https://storage.googleapis.com/musa5090s26-team3-public/tiles/{z}/{x}/{y}.pbf';

  // --- Property card references (needed by initValuationChart) ---
  const propertyCard = document.querySelector('.property-card');

  // --- Valuation History Chart ---
  let valuationChartInstance = null;

  function initValuationChart(props) {
    let canvas = document.getElementById('valuationLineChart');

    if (!canvas) {
      const chartHTML = `
        <div class="data-group" style="height: 160px; margin-top: 24px;">
          <label>Valuation History</label>
          <canvas id="valuationLineChart"></canvas>
        </div>
      `;
      propertyCard.insertAdjacentHTML('beforeend', chartHTML);
      canvas = document.getElementById('valuationLineChart');
    }

    const ctx = canvas.getContext('2d');

    if (valuationChartInstance) {
      valuationChartInstance.destroy();
    }

    const val2024 = props && props.market_value_2024 ? props.market_value_2024 : null;
    const val2025 = props && (props.market_value_2025 || props.marketValue2025)
      ? (props.market_value_2025 || props.marketValue2025) : null;
    const valPred = props && props.pred_value ? props.pred_value : null;

    valuationChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['2024 Assessed', '2025 Assessed', '2025 Predicted'],
        datasets: [{
          label: 'Value',
          data: [val2024, val2025, valPred],
          borderColor: '#1e40af',
          backgroundColor: 'rgba(30, 64, 175, 0.08)',
          fill: true,
          borderWidth: 2,
          pointBackgroundColor: ['#1e40af', '#1e40af', '#f97316'],
          pointRadius: 4,
          tension: 0.3,
        }],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => item.raw !== null ? '$' + item.raw.toLocaleString() : 'N/A',
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => '$' + (value / 1000).toFixed(0) + 'k',
            },
          },
        },
        maintainAspectRatio: false,
      },
    });
  }

  let selectedFeatureId = null;

  const tileLayer = L.vectorGrid.protobuf(tileUrl, {
    vectorTileLayerStyles: {
      'property_tile_info': (properties) => ({
        fillColor: getValueColor(properties.market_value_2025),
        fillOpacity: 0.8,
        stroke: true,
        color: '#ffffff',
        weight: 0.3,
        opacity: 0.5,
        fill: true,
      }),
    },
    interactive: true,
    maxNativeZoom: 18,
    maxZoom: 18,
    getFeatureId: (f) => f.properties.id,
  });

  tileLayer.on('click', (e) => {
    const props = e.layer.properties;

    // Reset previous highlight
    if (selectedFeatureId !== null) {
      tileLayer.resetFeatureStyle(selectedFeatureId);
    }

    // Highlight selected property
    selectedFeatureId = props.id;
    tileLayer.setFeatureStyle(props.id, {
      fillColor: '#facc15',
      fillOpacity: 1,
      stroke: true,
      color: '#1e40af',
      weight: 2,
      opacity: 1,
      fill: true,
    });

    document.getElementById('prop-address').textContent = props.address || '—';
    document.getElementById('prop-parcel').textContent = props.parcel_id || '—';
    document.getElementById('prop-assessed').textContent =
      props.market_value_2025 ? '$' + props.market_value_2025.toLocaleString() : '—';
    document.getElementById('prop-assessed-2024').textContent =
      props.market_value_2024 ? '$' + props.market_value_2024.toLocaleString() : '—';
    document.getElementById('prop-predicted').textContent =
      props.pred_value ? '$' + props.pred_value.toLocaleString() : '—';

    document.getElementById('details-placeholder').style.display = 'none';
    document.querySelector('.property-card').style.display = 'block';
    initValuationChart(props);
  });

  tileLayer.addTo(map);

  // --- 3. Property Search ---
  const detailsPlaceholder = document.getElementById('details-placeholder');
  const searchInput = document.getElementById('property-search');
  const searchBtn = document.querySelector('.btn-primary');
  let searchMarker = null;

  async function searchProperty() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchBtn.textContent = 'Searching…';
    searchBtn.disabled = true;

    try {
      const safe = query.toUpperCase().replace(/'/g, "''");
      const sql = `SELECT parcel_number, location, market_value, ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat FROM opa_properties_public WHERE location ILIKE '${safe}%' LIMIT 1`;
      const url = `https://phl.carto.com/api/v2/sql?q=${encodeURIComponent(sql)}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.rows || data.rows.length === 0) {
        searchBtn.textContent = 'Not found';
        setTimeout(() => {
          searchBtn.textContent = 'Search';
          searchBtn.disabled = false;
        }, 1500);
        return;
      }

      const row = data.rows[0];

      // Remove previous search marker
      if (searchMarker) map.removeLayer(searchMarker);

      // Fly to property and place a marker
      map.flyTo([row.lat, row.lng], 18);
      searchMarker = L.circleMarker([row.lat, row.lng], {
        radius: 10,
        color: '#1e40af',
        fillColor: '#facc15',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);

      // Populate sidebar
      document.getElementById('prop-address').textContent = row.location || '—';
      document.getElementById('prop-parcel').textContent = row.parcel_number || '—';
      document.getElementById('prop-assessed').textContent =
        row.market_value ? '$' + Number(row.market_value).toLocaleString() : '—';
      document.getElementById('prop-assessed-2024').textContent = '—';
      document.getElementById('prop-predicted').textContent = '—';

      detailsPlaceholder.style.display = 'none';
      propertyCard.style.display = 'block';
      initValuationChart({ marketValue2025: row.market_value || null });

    } catch (err) {
      console.error('Search failed:', err);
      searchBtn.textContent = 'Error';
      setTimeout(() => {
        searchBtn.textContent = 'Search';
        searchBtn.disabled = false;
      }, 1500);
      return;
    }

    searchBtn.textContent = 'Search';
    searchBtn.disabled = false;
  }

  searchBtn.addEventListener('click', searchProperty);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchProperty();
  });

  // --- 4. Initialize Sidebar Distribution Charts (Right Panel) ---
  // Assessment Value Distribution — loads real bin data from /configs/
  const BUCKET_URL = 'https://storage.googleapis.com/musa5090s26-team3-public';
  const TAIL_CAP = 1_500_000;
  const DISPLAY_BIN_WIDTH = 50_000; // aggregate source $25k bins into $50k buckets for legibility

  const fmtMoney = v => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`
    : `$${Math.round(v / 1000)}k`;

  // Roll source bins (any width) into fixed-width display buckets up to TAIL_CAP,
  // collapsing everything ≥ TAIL_CAP into a single tail bucket.
  function aggregateBins(rows, key = 'property_count') {
    const buckets = new Map();
    let tail = 0;
    for (const r of rows) {
      const count = r[key] ?? r.property_count ?? 0;
      if (r.lower_bound >= TAIL_CAP) {
        tail += count;
        continue;
      }
      const bucketLower = Math.floor(r.lower_bound / DISPLAY_BIN_WIDTH) * DISPLAY_BIN_WIDTH;
      buckets.set(bucketLower, (buckets.get(bucketLower) || 0) + count);
    }
    const out = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lower, count]) => ({
        lower,
        upper: lower + DISPLAY_BIN_WIDTH,
        count,
        isTail: false,
      }));
    if (tail > 0) {
      out.push({ lower: TAIL_CAP, upper: null, count: tail, isTail: true });
    }
    return out;
  }

  async function renderValueDistribution() {
    const res = await fetch(`${BUCKET_URL}/configs/tax_year_assessment_bins.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bins = await res.json();

    const latestYear = Math.max(...bins.map(b => b.tax_year));
    const rows = bins.filter(b => b.tax_year === latestYear);

    const aggregated = aggregateBins(rows);
    const tailCount = aggregated.find(b => b.isTail)?.count ?? 0;

    const seriesData = aggregated.map(b => ({
      x: b.lower,
      y: b.count,
      lower: b.lower,
      upper: b.upper,
      isTail: b.isTail,
    }));

    const container = document.getElementById('chart-container-1');
    container.innerHTML = '<div class="apex-chart-wrap" style="padding:8px 12px;height:100%;"><div id="apex-value-dist" style="height:100%;"></div></div>';

    const options = {
      chart: {
        type: 'bar',
        height: '100%',
        toolbar: { show: false },
        fontFamily: 'Inter, sans-serif',
        animations: { enabled: true, speed: 450, animateGradually: { enabled: false } },
        background: 'transparent',
      },
      series: [{ name: 'Properties', data: seriesData }],
      plotOptions: {
        bar: {
          columnWidth: '88%',
          borderRadius: 2,
          borderRadiusApplication: 'end',
        },
      },
      dataLabels: { enabled: false },
      stroke: { show: false },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.25,
          gradientToColors: ['#60a5fa'],
          inverseColors: false,
          opacityFrom: 1,
          opacityTo: 0.85,
          stops: [0, 100],
        },
      },
      colors: ['#1e40af'],
      xaxis: {
        type: 'numeric',
        min: 0,
        max: TAIL_CAP,
        tickAmount: 3,
        labels: {
          formatter: v => {
            const n = Number(v);
            if (tailCount > 0 && n >= TAIL_CAP) return `${fmtMoney(TAIL_CAP)}+`;
            return fmtMoney(n);
          },
          style: { fontSize: '11px', colors: '#64748b' },
          rotate: 0,
          hideOverlappingLabels: true,
        },
        axisBorder: { show: false },
        axisTicks: { color: '#e2e8f0' },
      },
      yaxis: {
        logarithmic: true,
        forceNiceScale: true,
        labels: {
          formatter: v => {
            const n = Math.round(v);
            if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
            return `${n}`;
          },
          style: { fontSize: '11px', colors: '#64748b' },
        },
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 3,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      tooltip: {
        theme: 'light',
        x: { show: false },
        custom: ({ dataPointIndex, w }) => {
          const d = w.config.series[0].data[dataPointIndex];
          const range = d.isTail
            ? `${fmtMoney(d.lower)} and above`
            : `${fmtMoney(d.lower)} – ${fmtMoney(d.upper)}`;
          return `
            <div style="padding:8px 12px;font-family:Inter,sans-serif;">
              <div style="font-size:11px;color:#64748b;margin-bottom:2px;">${range}</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a;">
                ${d.y.toLocaleString()} properties
              </div>
            </div>
          `;
        },
      },
      title: {
        text: `Assessed Value Distribution (${latestYear})`,
        align: 'left',
        margin: 4,
        style: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
      },
      subtitle: {
        text: `Bin width: ${fmtMoney(DISPLAY_BIN_WIDTH)} · Tail: ${fmtMoney(TAIL_CAP)}+`,
        align: 'left',
        style: { fontSize: '11px', color: '#94a3b8' },
      },
    };

    const chart = new ApexCharts(document.getElementById('apex-value-dist'), options);
    chart.render();
  }

  renderValueDistribution().catch(err => {
    console.error('Failed to load assessment bins:', err);
    const span = document.querySelector('#chart-container-1 span');
    if (span) span.textContent = 'Failed to load distribution';
  });

  // Assessed vs Predicted Comparison (issue #19) — overlays both distributions on
  // the same bins so reviewers can spot where the model diverges from current assessments.
  async function renderComparisonDistribution() {
    const [assessedRes, predictedRes] = await Promise.all([
      fetch(`${BUCKET_URL}/configs/tax_year_assessment_bins.json`),
      fetch(`${BUCKET_URL}/configs/current_assessment_bins.json`),
    ]);
    if (!assessedRes.ok) throw new Error(`assessed HTTP ${assessedRes.status}`);
    if (!predictedRes.ok) throw new Error(`predicted HTTP ${predictedRes.status}`);

    const [assessedRaw, predictedRaw] = await Promise.all([
      assessedRes.json(),
      predictedRes.json(),
    ]);

    if (!Array.isArray(predictedRaw) || predictedRaw.length === 0) {
      throw new Error('empty predicted bins');
    }

    const latestYear = Math.max(...assessedRaw.map(b => b.tax_year));
    const assessed = assessedRaw.filter(b => b.tax_year === latestYear);

    // Aggregate each dataset into shared $50k buckets, then merge by lower bound.
    const assessedBuckets = aggregateBins(assessed);
    const predictedBuckets = aggregateBins(predictedRaw);

    const binMap = new Map();
    function upsert(buckets, key) {
      for (const b of buckets) {
        const existing = binMap.get(b.lower);
        if (existing) {
          existing[key] = b.count;
        } else {
          binMap.set(b.lower, { lower: b.lower, upper: b.upper, isTail: b.isTail, assessed: 0, predicted: 0, [key]: b.count });
        }
      }
    }
    upsert(assessedBuckets, 'assessed');
    upsert(predictedBuckets, 'predicted');

    const sortedBins = [...binMap.values()].sort((a, b) => a.lower - b.lower);
    const assessedSeries = sortedBins.map(b => ({ x: b.lower, y: b.assessed }));
    const predictedSeries = sortedBins.map(b => ({ x: b.lower, y: b.predicted }));

    const container = document.getElementById('chart-container-2');
    container.innerHTML = '<div class="apex-chart-wrap" style="padding:8px 12px;height:100%;"><div id="apex-comparison" style="height:100%;"></div></div>';

    const options = {
      chart: {
        type: 'area',
        height: '100%',
        toolbar: { show: false },
        fontFamily: 'Inter, sans-serif',
        animations: { enabled: true, speed: 450, animateGradually: { enabled: false } },
        background: 'transparent',
      },
      series: [
        { name: `Assessed (${latestYear})`, data: assessedSeries },
        { name: 'Predicted (CAMA Model)', data: predictedSeries },
      ],
      dataLabels: { enabled: false },
      stroke: { curve: 'stepline', width: 2 },
      colors: ['#1e40af', '#047857'],
      fill: {
        type: 'solid',
        opacity: [0.18, 0.18],
      },
      markers: { size: 0 },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '11px',
        markers: { width: 10, height: 10 },
        itemMargin: { horizontal: 8, vertical: 0 },
      },
      xaxis: {
        type: 'numeric',
        min: 0,
        max: TAIL_CAP,
        tickAmount: 3,
        labels: {
          formatter: v => {
            const n = Number(v);
            if (n >= TAIL_CAP) return `${fmtMoney(TAIL_CAP)}+`;
            return fmtMoney(n);
          },
          style: { fontSize: '11px', colors: '#64748b' },
          rotate: 0,
          hideOverlappingLabels: true,
        },
        axisBorder: { show: false },
        axisTicks: { color: '#e2e8f0' },
      },
      yaxis: {
        logarithmic: true,
        forceNiceScale: true,
        labels: {
          formatter: v => {
            const n = Math.round(v);
            if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
            return `${n}`;
          },
          style: { fontSize: '11px', colors: '#64748b' },
        },
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 3,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      tooltip: {
        theme: 'light',
        shared: true,
        intersect: false,
        x: { show: false },
        custom: ({ dataPointIndex }) => {
          const b = sortedBins[dataPointIndex];
          const range = b.isTail
            ? `${fmtMoney(b.lower)} and above`
            : `${fmtMoney(b.lower)} – ${fmtMoney(b.upper)}`;
          const diff = b.predicted - b.assessed;
          const diffLabel = diff === 0
            ? ''
            : `<div style="font-size:11px;color:${diff > 0 ? '#047857' : '#b91c1c'};margin-top:4px;">
                 ${diff > 0 ? '+' : ''}${diff.toLocaleString()} predicted vs. assessed
               </div>`;
          return `
            <div style="padding:8px 12px;font-family:Inter,sans-serif;min-width:180px;">
              <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${range}</div>
              <div style="font-size:12px;color:#1e40af;display:flex;justify-content:space-between;gap:12px;">
                <span>Assessed (${latestYear})</span>
                <strong>${b.assessed.toLocaleString()}</strong>
              </div>
              <div style="font-size:12px;color:#047857;display:flex;justify-content:space-between;gap:12px;">
                <span>Predicted</span>
                <strong>${b.predicted.toLocaleString()}</strong>
              </div>
              ${diffLabel}
            </div>
          `;
        },
      },
      title: {
        text: 'Assessed vs. Predicted Distribution',
        align: 'left',
        margin: 4,
        style: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
      },
      subtitle: {
        text: `${latestYear} assessments vs. CAMA predictions · ${fmtMoney(DISPLAY_BIN_WIDTH)} bins · log scale`,
        align: 'left',
        style: { fontSize: '11px', color: '#94a3b8' },
      },
    };

    const chart = new ApexCharts(document.getElementById('apex-comparison'), options);
    chart.render();
  }

  function showComparisonEmptyState(message) {
    const container = document.getElementById('chart-container-2');
    container.innerHTML = `
      <div class="chart-placeholder" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;color:#94a3b8;">
        <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:8px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <div style="font-size:13px;font-weight:600;color:#475569;">Assessed vs Predicted</div>
        <div style="font-size:11px;margin-top:4px;">${message}</div>
        <small style="margin-top:6px;color:#cbd5e1;">Will populate when <code>configs/current_assessment_bins.json</code> is published</small>
      </div>
    `;
  }

  renderComparisonDistribution().catch(err => {
    console.warn('Comparison distribution unavailable:', err.message);
    showComparisonEmptyState('ML model predictions not available yet');
  });

  // --- 4. Shared chart helpers ---
  function formatDollar(val) {
    if (val >= 1000000) return '$' + (val / 1000000) + 'M';
    if (val >= 1000) return '$' + (val / 1000) + 'k';
    return '$' + val;
  }

  function setupCanvas(containerId, canvasId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<div style="position:relative;height:100%;width:100%;padding:16px;"><canvas id="${canvasId}"></canvas></div>`;
    return document.getElementById(canvasId).getContext('2d');
  }

  function buildChartOptions(labels) {
    return {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              const lower = labels[i];
              const upper = lower + 25000;
              return `${formatDollar(lower)} – ${formatDollar(upper)}`;
            },
            label: (item) => `${item.raw.toLocaleString()} properties`,
          },
        },
      },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: (val) => val.toLocaleString(),
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            callback: (val, i) => {
              const total = labels.length;
              const step = Math.max(1, Math.floor(total / 4));
              if (i === 0 || i === total - 1 || i % step === 0) {
                return formatDollar(labels[i]);
              }
              return '';
            },
            maxRotation: 0,
            autoSkip: false,
          },
        },
      },
      maintainAspectRatio: false,
      responsive: true,
    };
  }

  // --- 5. Tax Year Distribution Chart ---
  let taxYearChartInstance = null;
  let taxYearData = [];

  try {
    const res = await fetch(`${BUCKET_BASE}/configs/tax_year_assessment_bins.json`);
    taxYearData = await res.json();

    const years = [...new Set(taxYearData.map((d) => d.tax_year))].sort();

    const yearSelect = document.getElementById('year-select');
    years.forEach((y) => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    yearSelect.value = years[years.length - 1];

    function renderTaxYearChart(year) {
      const yearData = taxYearData
        .filter((d) => d.tax_year === year && d.lower_bound <= MAX_VALUE);
      const labels = yearData.map((d) => d.lower_bound);
      const counts = yearData.map((d) => d.property_count);

      const ctx = setupCanvas('chart-container-1', 'taxYearCanvas');

      if (taxYearChartInstance) taxYearChartInstance.destroy();

      taxYearChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: 'rgba(30, 64, 175, 0.7)',
            borderColor: '#1e40af',
            borderWidth: 1,
            borderRadius: 2,
          }],
        },
        options: buildChartOptions(labels),
      });
    }

    renderTaxYearChart(years[years.length - 1]);

    yearSelect.addEventListener('change', (e) => {
      renderTaxYearChart(parseInt(e.target.value));
    });

  } catch (e) {
    console.error('Failed to load tax year data:', e);
    document.getElementById('chart-container-1').innerHTML =
      '<p style="padding:16px;color:#94a3b8;">Could not load distribution data.</p>';
  }

  // --- 6. Current Model Assessment Distribution Chart ---
  try {
    const res = await fetch(`${BUCKET_BASE}/configs/current_assessment_bins.json`);
    const currentData = await res.json();

    const filtered = currentData.filter((d) => d.lower_bound <= MAX_VALUE);
    const labels = filtered.map((d) => d.lower_bound);
    const counts = filtered.map((d) => d.property_count);

    const ctx = setupCanvas('chart-container-2', 'currentCanvas');

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: 'rgba(100, 116, 139, 0.7)',
          borderColor: '#64748b',
          borderWidth: 1,
          borderRadius: 2,
        }],
      },
      options: buildChartOptions(labels),
    });

  } catch (e) {
    console.error('Failed to load current assessment data:', e);
    document.getElementById('chart-container-2').innerHTML =
      '<p style="padding:16px;color:#94a3b8;">Could not load distribution data.</p>';
  }
});
