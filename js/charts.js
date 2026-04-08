// DiaMetrics — charts.js
'use strict';

const P = {
  blue:    '#3b82f6',
  green:   '#10b981',
  red:     '#ef4444',
  amber:   '#f59e0b',
  purple:  '#8b5cf6',
  teal:    '#06b6d4',
  orange:  '#f97316',
  rose:    '#f43f5e',
  indigo:  '#6366f1',
  palette: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'],
};

const Charts = {
  _defaults(type) {
    const dark  = State.theme === 'dark';
    const tick  = dark ? '#9ca3af' : '#6b7280';
    const grid  = dark ? '#374151' : '#e5e7eb';
    const font  = { family: 'Inter, sans-serif', size: 12 };
    const base  = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: tick, font } },
        tooltip: { backgroundColor: dark?'#1f2937':'#fff', titleColor: tick, bodyColor: tick,
                   borderColor: grid, borderWidth: 1 },
      },
    };
    if (type === 'line' || type === 'bar') {
      base.scales = {
        x: { ticks: { color: tick, font }, grid: { color: grid } },
        y: { ticks: { color: tick, font }, grid: { color: grid } },
      };
    }
    return base;
  },

  make(id, type, data, opts = {}) {
    State.destroyChart(id);
    const canvas = $(id);
    if (!canvas) return null;
    const merged = this._merge(this._defaults(type), opts);
    const ch = new Chart(canvas, { type, data, options: merged });
    State.setChart(id, ch);
    return ch;
  },

  _merge(base, over) {
    const out = { ...base };
    for (const k in over) {
      if (
        over[k] !== null &&
        typeof over[k] === 'object' &&
        !Array.isArray(over[k]) &&
        typeof base[k] === 'object' &&
        !Array.isArray(base[k])
      ) {
        out[k] = this._merge(base[k] || {}, over[k]);
      } else {
        out[k] = over[k];
      }
    }
    return out;
  },

  line(id, labels, datasets, opts = {}) {
    return this.make(id, 'line', {
      labels,
      datasets: datasets.map((d, i) => ({
        tension: 0.3, pointRadius: 4, pointHoverRadius: 6,
        borderColor: P.palette[i % P.palette.length],
        backgroundColor: P.palette[i % P.palette.length] + '22',
        fill: false,
        ...d,
      })),
    }, opts);
  },

  bar(id, labels, datasets, opts = {}) {
    return this.make(id, 'bar', {
      labels,
      datasets: datasets.map((d, i) => ({
        backgroundColor: P.palette[i % P.palette.length] + 'bb',
        borderColor:     P.palette[i % P.palette.length],
        borderWidth: 1,
        borderRadius: 4,
        ...d,
      })),
    }, opts);
  },

  doughnut(id, labels, values, colors, opts = {}) {
    return this.make(id, 'doughnut', {
      labels,
      datasets: [{ data: values, backgroundColor: colors || P.palette, borderWidth: 2 }],
    }, { plugins: { legend: { position: 'right' } }, ...opts });
  },

  scatter(id, datasets, opts = {}) {
    return this.make(id, 'scatter', { datasets }, opts);
  },

  // Glucose-specific line with threshold bands
  glucLine(id, labels, values, thresholds = {}) {
    const low  = thresholds.low  || C.GLUCOSE.NORMAL_LOW;
    const high = thresholds.high || C.GLUCOSE.NORMAL_HIGH;
    const colors = values.map(v =>
      v < low || v > high ? P.red + '99' : P.green + '99'
    );
    return this.make(id, 'line', {
      labels,
      datasets: [{
        label: 'Glucose (mg/dL)',
        data: values,
        borderColor: P.blue,
        backgroundColor: P.blue + '22',
        pointBackgroundColor: colors,
        pointRadius: 5,
        tension: 0.3,
        fill: false,
      }],
    }, {
      plugins: {
        annotation: undefined, // remove if no plugin
        legend: { display: false },
      },
      scales: {
        y: {
          suggestedMin: 50,
          suggestedMax: 300,
        },
      },
    });
  },

  // Heatmap (rendered as a grid using canvas 2D)
  heatmap(id, data, labels) {
    // data: array of {hour:0-23, dow:0-6, value}
    const canvas = $(id);
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const PAD  = 36;
    const W    = (canvas.offsetWidth || 600) - PAD;
    const H    = 200;
    canvas.width  = (canvas.offsetWidth || 600);
    canvas.height = H;
    const cols = 24;
    const rows = 7;
    const cw   = W / cols;
    const rh   = H / rows;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    ctx.clearRect(0, 0, canvas.width, H);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const entry = data.find(d => d.hour === c && d.dow === r);
        const val   = entry ? entry.value : null;
        ctx.fillStyle = val === null
          ? (State.theme === 'dark' ? '#1f2937' : '#f3f4f6')
          : _heatColor(val);
        ctx.fillRect(PAD + c * cw + 1, r * rh + 1, cw - 2, rh - 2);
      }
    }

    ctx.fillStyle = State.theme === 'dark' ? '#9ca3af' : '#6b7280';
    ctx.font      = '10px Inter,sans-serif';
    ctx.textAlign = 'right';
    days.forEach((d, i) => {
      ctx.fillText(d, PAD - 4, i * rh + rh / 2 + 4);
    });
  },
};

function _heatColor(mg) {
  if (mg < C.GLUCOSE.HYPO)         return '#fca5a5'; // light red
  if (mg <= C.GLUCOSE.NORMAL_HIGH) return '#6ee7b7'; // light green
  if (mg <= C.GLUCOSE.HIGH)        return '#fcd34d'; // amber
  return '#f87171';                                   // red
}
