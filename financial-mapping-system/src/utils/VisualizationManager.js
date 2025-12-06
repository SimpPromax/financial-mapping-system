// utils/visualizationManager.js
import * as d3 from 'd3';
import Swal from 'sweetalert2';

// Refined, professional theme with paler colors
const THEME = {
    colors: {
        primary: '#4f9cf7',         // Softer blue
        primaryLight: '#dbe9ff',    // Pale fill for highlights
        secondary: '#a78bfa',       // Muted purple
        success: '#4ade80',         // Gentle green
        warning: '#fbbf24',         // Soft amber
        danger: '#f87171',          // Muted coral
        info: '#38bdf8',            // Light sky
        light: '#f9fafb',           // Off-white background
        dark: '#1f2937',
        gray: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827'
        }
    },
    gradients: {
        blue: ['#dbe9ff', '#a3c4f3', '#4f9cf7'],
        purple: ['#ede9fe', '#c4b5fd', '#a78bfa'],
        teal: ['#ccfbf1', '#75f0da', '#4ade80'],
        orange: ['#ffedd5', '#fdba74', '#fbbf24']
    },
    typography: {
        title: { size: 20, weight: 600, color: '#1f2937' },
        axisTitle: { size: 13, weight: 600, color: '#4b5563' },
        axisLabel: { size: 12, weight: 500, color: '#6b7280' },
        dataLabel: { size: 11, weight: 600, color: '#374151' }
    }
};

// Smoother, faster animation
const ANIMATION = {
    duration: 600,
    easing: d3.easeCubicOut
};

// Singleton tooltip
let tooltip = null;

// Chart state management
const CHART_STATE = {
    activePieSlice: null,
    activeDonutSlice: null
};

function initTooltip() {
    if (tooltip) return;
    d3.select('.global-d3-tooltip').remove();

    tooltip = d3.select('body')
        .append('div')
        .attr('class', 'global-d3-tooltip')
        .style('position', 'fixed')
        .style('padding', '12px 16px')
        .style('background', THEME.colors.light)
        .style('color', THEME.colors.dark)
        .style('border-radius', '12px')
        .style('pointer-events', 'none')
        .style('z-index', '9999')
        .style('font-family', 'Inter, system-ui, sans-serif')
        .style('font-size', '14px')
        .style('backdrop-filter', 'blur(8px)')
        .style('border', `1px solid ${THEME.colors.gray[300]}`)
        .style('box-shadow', `
            0 10px 20px -5px rgba(0, 0, 0, 0.08),
            0 4px 6px -4px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(0, 0, 0, 0.02)
        `)
        .style('max-width', '320px')
        .style('opacity', 0)
        .style('transform', 'translate(-50%, 10px)')
        .style('transition', 'opacity 0.2s ease, transform 0.2s ease');
}

function showTooltip(event, content) {
    if (!tooltip) initTooltip();

    tooltip
        .html(content)
        .style('left', `${event.pageX}px`)
        .style('top', `${event.pageY - 70}px`)
        .style('opacity', 1)
        .style('transform', 'translate(-50%, 0)');
}

function hideTooltip() {
    if (tooltip) {
        tooltip
            .style('opacity', 0)
            .style('transform', 'translate(-50%, 10px)');
    }
}

// --- Export Utilities ---
/**
 * Exports the chart inside the container as an SVG file.
 * @param {HTMLElement} container - The DOM container holding the chart
 * @param {string} filename - Desired filename (e.g., 'chart.svg')
 */
function exportChartAsSVG(container, filename = 'chart.svg') {
    if (!container) {
        console.warn('Container is null');
        return;
    }
    const svg = container.querySelector('svg');
    if (!svg) {
        Swal.fire({
            icon: 'warning',
            title: 'No Chart to Export',
            text: 'The container does not contain a chart.',
            confirmButtonColor: THEME.colors.warning,
        });
        return;
    }

    // Clone to avoid side effects
    const clone = svg.cloneNode(true);

    // Ensure width/height are explicit for reliable rendering
    const bbox = svg.getBBox();
    const width = bbox.width > 0 ? bbox.width : 800;
    const height = bbox.height > 0 ? bbox.height : 550;
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Serialize
    const serializer = new XMLSerializer();
    let svgData = serializer.serializeToString(clone);

    // Add XML declaration if missing
    if (!svgData.startsWith('<?xml')) {
        svgData = '<?xml version="1.0" standalone="no"?>\n' + svgData;
    }

    // Create blob and download
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Exports the chart as a PNG using canvas rasterization.
 * Self-contained — no external libraries.
 * @param {HTMLElement} container - The DOM container holding the chart
 * @param {string} filename - Desired filename (e.g., 'chart.png')
 */
function exportChartAsPNG(container, filename = 'chart.png') {
    if (!container) {
        console.warn('Container is null');
        return;
    }
    const svg = container.querySelector('svg');
    if (!svg) {
        Swal.fire({
            icon: 'warning',
            title: 'No Chart to Export',
            text: 'The container does not contain a chart.',
            confirmButtonColor: THEME.colors.warning,
        });
        return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Get dimensions (with fallback)
    const bbox = svg.getBBox();
    const width = bbox.width > 0 ? bbox.width : 800;
    const height = bbox.height > 0 ? bbox.height : 550;

    // Use 2x resolution for sharp PNG
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;

    // Set white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Encode SVG as data URL
    const imgSrc = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

    img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
            if (!blob) {
                Swal.fire({
                    icon: 'error',
                    title: 'Export Failed',
                    text: 'Failed to generate PNG. Try exporting as SVG instead.',
                    confirmButtonColor: THEME.colors.danger,
                });
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png', 0.92);
    };

    img.onerror = () => {
        Swal.fire({
            icon: 'error',
            title: 'PNG Export Failed',
            text: 'The browser could not render the chart for PNG export. Try SVG instead.',
            confirmButtonColor: THEME.colors.danger,
        });
    };

    img.src = imgSrc;
}

// --- Shared Utilities ---
function processChartData(data, config) {
    const { xAxis, yAxis, chartType, sortData } = config;

    let processed = data
        .map(row => ({
            x: row[xAxis]?.toString() || 'N/A',
            y: typeof row[yAxis] === 'number' ? row[yAxis] : parseFloat(row[yAxis]) || 0,
            label: row[xAxis]?.toString() || 'N/A',
            value: typeof row[yAxis] === 'number' ? row[yAxis] : parseFloat(row[yAxis]) || 0,
            raw: row,
        }))
        .filter(d => d.x !== 'N/A' && !isNaN(d.y));

    // Aggregate for bar and line charts to prevent duplicate x-values
    if (chartType === 'bar' || chartType === 'line') {
        const grouped = d3.rollup(
            processed,
            v => d3.sum(v, d => d.y),
            d => d.x
        );
        processed = Array.from(grouped, ([x, y]) => ({ x, y, label: x, value: y }));
    }

    if (chartType === 'pie' || chartType === 'donut') {
        const grouped = d3.rollup(
            processed,
            v => d3.sum(v, d => d.y),
            d => d.label
        );
        return Array.from(grouped, ([label, value]) => ({ label, value }));
    }

    if (sortData) {
        processed.sort((a, b) => a.y - b.y);
    }

    return processed;
}

function getColor(index, chartType = 'bar') {
    const colorSchemes = {
        bar: ['#4f9cf7', '#a78bfa', '#4ade80', '#fbbf24', '#f87171', '#38bdf8', '#86efac', '#fdba74'],
        line: ['#4f9cf7', '#a78bfa', '#4ade80', '#fbbf24'],
        pie: d3.schemeTableau10,
        donut: d3.schemeSet3,
        scatter: ['#4f9cf7', '#4ade80', '#fbbf24', '#f87171', '#a78bfa']
    };

    const scheme = colorSchemes[chartType] || colorSchemes.bar;
    return scheme[index % scheme.length];
}

function createGradient(svg, id, colors, isVertical = true) {
    const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', id)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', isVertical ? '0%' : '100%')
        .attr('y2', isVertical ? '100%' : '0%');

    colors.forEach((color, i) => {
        gradient.append('stop')
            .attr('offset', `${(i / (colors.length - 1)) * 100}%`)
            .attr('stop-color', color);
    });

    return gradient;
}

function clearChart(container) {
    if (!container) return;
    d3.select(container).selectAll('*').remove();
    // Reset chart states
    CHART_STATE.activePieSlice = null;
    CHART_STATE.activeDonutSlice = null;
}

function createChartSVG(container, height = 550) {
    clearChart(container);
    const width = container.clientWidth || 800;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('background', THEME.colors.light)
        .style('border-radius', '12px')
        .style('box-shadow', '0 1px 4px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)');

    // Subtle grid pattern
    svg.append('defs')
        .append('pattern')
        .attr('id', 'grid-pattern')
        .attr('width', 20)
        .attr('height', 20)
        .attr('patternUnits', 'userSpaceOnUse')
        .append('path')
        .attr('d', 'M 20 0 L 0 0 0 20')
        .attr('fill', 'none')
        .attr('stroke', THEME.colors.gray[100])
        .attr('stroke-width', 1);

    return { svg, width, height };
}

function addChartLabels(svg, width, height, margin, config) {
    const { xAxis, yAxis, title } = config;
    const { typography } = THEME;

    // X-axis label
    svg.append('text')
        .attr('transform', `translate(${width / 2},${height - margin.bottom + 45})`)
        .style('text-anchor', 'middle')
        .style('font-size', `${typography.axisTitle.size}px`)
        .style('font-weight', typography.axisTitle.weight)
        .style('fill', typography.axisTitle.color)
        .style('letter-spacing', '0.025em')
        .text(xAxis || '');

    // Y-axis label
    svg.append('text')
        .attr('transform', `translate(${margin.left - 55},${height / 2}) rotate(-90)`)
        .style('text-anchor', 'middle')
        .style('font-size', `${typography.axisTitle.size}px`)
        .style('font-weight', typography.axisTitle.weight)
        .style('fill', typography.axisTitle.color)
        .style('letter-spacing', '0.025em')
        .text(yAxis || '');

    // Chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', margin.top / 2 - 10)
        .attr('text-anchor', 'middle')
        .style('font-size', `${typography.title.size}px`)
        .style('font-weight', typography.title.weight)
        .style('fill', typography.title.color)
        .style('letter-spacing', '-0.025em')
        .text(title || `${yAxis} by ${xAxis}`);

    // Subtitle
    if (title) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', margin.top / 2 + 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', THEME.colors.gray[500])
            .style('font-weight', 400)
            .style('letter-spacing', '0.05em')
            .text(`${yAxis} by ${xAxis}`);
    }
}

function addGridLines(svg, x, y, width, height, margin) {
    // Horizontal grid
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x)
            .tickSize(-height + margin.top + margin.bottom)
            .tickFormat('')
        )
        .selectAll('line')
        .attr('stroke', THEME.colors.gray[200])
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,4');

    // Vertical grid
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y)
            .tickSize(-width + margin.left + margin.right)
            .tickFormat('')
        )
        .selectAll('line')
        .attr('stroke', THEME.colors.gray[200])
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,4');
}

// --- Chart Implementations ---
function createBarChart(container, data, config) {
    const { svg, width } = createChartSVG(container, 550);
    const height = 550;
    const margin = { top: 80, right: 40, bottom: 120, left: 90 };

    const chartData = processChartData(data, { ...config, chartType: 'bar' });
    if (chartData.length === 0) return false;

    const x = d3.scaleBand()
        .domain(chartData.map(d => d.x))
        .range([margin.left, width - margin.right])
        .padding(0.4);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.y) * 1.1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    addGridLines(svg, x, y, width, height, margin);

    const gradientId = `bar-gradient-${Date.now()}`;
    createGradient(svg, gradientId, THEME.gradients.blue);

    const bars = svg.selectAll('.bar')
        .data(chartData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.x))
        .attr('y', height - margin.bottom)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', `url(#${gradientId})`)
        .on('mouseover', function (event, d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('fill', THEME.colors.primaryLight)
                .attr('filter', 'drop-shadow(0 2px 6px rgba(79, 156, 247, 0.25))')
                .attr('transform', 'translateY(-2px)');

            showTooltip(event, `
                <div style="margin-bottom: 4px; font-weight: 600; color: ${THEME.colors.dark}">${d.x}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${THEME.colors.primary}; border-radius: 2px;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">${config.yAxis}:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.y)}</span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: ${THEME.colors.gray[500]}">
                    ${config.xAxis} → ${config.yAxis}
                </div>
            `);
        })
        .on('mouseout', function () {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('fill', `url(#${gradientId})`)
                .attr('filter', 'none')
                .attr('transform', 'translateY(0)');
            hideTooltip();
        });

    bars.transition()
        .duration(ANIMATION.duration)
        .ease(ANIMATION.easing)
        .attr('y', d => y(d.y))
        .attr('height', d => height - margin.bottom - y(d.y));

    svg.selectAll('.bar-label')
        .data(chartData)
        .enter()
        .append('text')
        .attr('x', d => x(d.x) + x.bandwidth() / 2)
        .attr('y', height - margin.bottom)
        .attr('text-anchor', 'middle')
        .style('font-size', `${THEME.typography.dataLabel.size}px`)
        .style('font-weight', THEME.typography.dataLabel.weight)
        .style('fill', THEME.colors.gray[600])
        .style('opacity', 0)
        .text(d => d3.format(',.0f')(d.y))
        .transition()
        .delay(ANIMATION.duration)
        .duration(300)
        .attr('y', d => y(d.y) - 8)
        .style('opacity', 1);

    const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    xAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight)
        .attr('transform', 'rotate(-45)')
        .attr('dx', '-.8em')
        .attr('dy', '.15em');

    xAxis.select('.domain')
        .attr('stroke', THEME.colors.gray[300])
        .attr('stroke-width', 2);

    xAxis.selectAll('line')
        .attr('stroke', THEME.colors.gray[300]);

    const yAxis = svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d3.format(',.0f')).ticks(8));

    yAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight);

    yAxis.select('.domain')
        .attr('stroke', THEME.colors.gray[300])
        .attr('stroke-width', 2);

    yAxis.selectAll('line')
        .attr('stroke', THEME.colors.gray[300]);

    addChartLabels(svg, width, height, margin, config);
    return true;
}

function createLineChart(container, data, config) {
    const { svg, width } = createChartSVG(container, 550);
    const height = 550;
    const margin = { top: 80, right: 40, bottom: 120, left: 90 };

    let chartData = processChartData(data, { ...config, chartType: 'line' });
    if (chartData.length === 0) return false;

    chartData.sort((a, b) => a.x.localeCompare(b.x));

    const x = d3.scalePoint()
        .domain(chartData.map(d => d.x))
        .range([margin.left, width - margin.right])
        .padding(0.5);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.y) * 1.1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    addGridLines(svg, x, y, width, height, margin);

    const line = d3.line()
        .x(d => x(d.x))
        .y(d => y(d.y))
        .curve(d3.curveMonotoneX);

    const area = d3.area()
        .x(d => x(d.x))
        .y0(height - margin.bottom)
        .y1(d => y(d.y))
        .curve(d3.curveMonotoneX);

    const areaGradientId = `area-gradient-${Date.now()}`;
    const areaGradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', areaGradientId)
        .attr('x1', '0%').attr('y1', '0%')
        .attr('x2', '0%').attr('y2', '100%');

    areaGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', THEME.colors.primary)
        .attr('stop-opacity', 0.15);

    areaGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', THEME.colors.primary)
        .attr('stop-opacity', 0);

    svg.append('path')
        .datum(chartData)
        .attr('fill', `url(#${areaGradientId})`)
        .attr('d', area);

    const path = svg.append('path')
        .datum(chartData)
        .attr('fill', 'none')
        .attr('stroke', THEME.colors.primary)
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('d', line)
        .attr('stroke-dasharray', function () { return this.getTotalLength(); })
        .attr('stroke-dashoffset', function () { return this.getTotalLength(); });

    path.transition()
        .duration(ANIMATION.duration * 1.5)
        .ease(ANIMATION.easing)
        .attr('stroke-dashoffset', 0);

    const points = svg.selectAll('.point')
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => x(d.x))
        .attr('cy', height - margin.bottom)
        .attr('r', 0)
        .attr('fill', 'white')
        .attr('stroke', THEME.colors.primary)
        .attr('stroke-width', 2)
        .on('mouseover', function (event, d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', 9)
                .attr('fill', THEME.colors.primary);

            showTooltip(event, `
                <div style="margin-bottom: 4px; font-weight: 600; color: ${THEME.colors.dark}">${d.x}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${THEME.colors.primary}; border-radius: 50%;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">${config.yAxis}:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.y)}</span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: ${THEME.colors.gray[500]}">
                    Trend point at ${d.x}
                </div>
            `);
        })
        .on('mouseout', function () {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', 6)
                .attr('fill', 'white');
            hideTooltip();
        });

    points.transition()
        .delay((d, i) => (i / chartData.length) * ANIMATION.duration)
        .duration(300)
        .attr('cy', d => y(d.y))
        .attr('r', 6);

    const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    xAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight)
        .attr('transform', 'rotate(-45)')
        .attr('dx', '-.8em')
        .attr('dy', '.15em');

    const yAxis = svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d3.format(',.0f')));

    yAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight);

    addChartLabels(svg, width, height, margin, config);
    return true;
}

function createPieChart(container, data, config) {
    const { svg, width } = createChartSVG(container, 550);
    const height = 550;
    const radius = Math.min(width, height) / 2 - 80;
    const centerX = width / 2;
    const centerY = height / 2;

    const chartData = processChartData(data, { ...config, chartType: 'pie' });
    if (chartData.length === 0) return false;

    const total = d3.sum(chartData, d => d.value);
    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const labelArc = d3.arc().innerRadius(radius * 0.7).outerRadius(radius * 0.7);
    const arcs = pie(chartData);

    const g = svg.append('g')
        .attr('transform', `translate(${centerX},${centerY})`);

    const defs = svg.append('defs');
    const filter = defs.append('filter')
        .attr('id', 'pie-shadow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');

    filter.append('feDropShadow')
        .attr('dx', 0)
        .attr('dy', 2)
        .attr('stdDeviation', 3)
        .attr('flood-opacity', 0.1);

    const slices = g.selectAll('.slice')
        .data(arcs)
        .enter()
        .append('g')
        .attr('class', 'slice');

    const paths = slices.append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => getColor(i, 'pie'))
        .attr('stroke', THEME.colors.light)
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('filter', 'url(#pie-shadow)')
        .attr('opacity', 0)
        .on('mouseover', function (event, d) {
            if (CHART_STATE.activePieSlice !== d.index) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke-width', 3)
                    .attr('stroke', THEME.colors.gray[300]);
            }

            const percentage = (d.data.value / total * 100).toFixed(1);
            showTooltip(event, `
                <div style="margin-bottom: 4px; font-weight: 600; color: ${THEME.colors.dark}">${d.data.label}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${getColor(d.index, 'pie')}; border-radius: 2px;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">Value:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.data.value)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <span style="color: ${THEME.colors.gray[600]}">Percentage:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.primary}">${percentage}%</span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: ${THEME.colors.gray[500]}">
                    Part of whole: ${d.data.value.toLocaleString()} / ${total.toLocaleString()}
                </div>
            `);
        })
        .on('mouseout', function (event, d) {
            if (CHART_STATE.activePieSlice !== d.index) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke-width', 2)
                    .attr('stroke', THEME.colors.light);
            }
            hideTooltip();
        })
        .on('click', function (event, d) {
            // Toggle highlight on slice click
            if (CHART_STATE.activePieSlice === d.index) {
                resetPieHighlight();
                CHART_STATE.activePieSlice = null;
            } else {
                highlightPieSlice(d.index);
                CHART_STATE.activePieSlice = d.index;
            }
        });

    paths.transition()
        .delay((d, i) => i * 100)
        .duration(ANIMATION.duration)
        .ease(ANIMATION.easing)
        .attrTween('d', function (d) {
            const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function (t) {
                return arc(interpolate(t));
            };
        })
        .attr('opacity', 1);

    slices.filter(d => (d.data.value / total) > 0.05)
        .append('text')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '12px')
        .style('font-weight', 600)
        .style('fill', THEME.colors.dark)
        .style('text-shadow', '0 1px 2px rgba(255, 255, 255, 0.9)')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .text(d => d.data.label)
        .transition()
        .delay(ANIMATION.duration + 200)
        .duration(300)
        .style('opacity', 1);

    slices.filter(d => (d.data.value / total) > 0.02 && (d.data.value / total) <= 0.05)
        .append('text')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .style('font-size', '10px')
        .style('font-weight', 600)
        .style('fill', THEME.colors.dark)
        .style('opacity', 0)
        .text(d => d3.format(',.0f')(d.data.value))
        .transition()
        .delay(ANIMATION.duration + 300)
        .duration(300)
        .style('opacity', 0.8);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', `${THEME.typography.title.size}px`)
        .style('font-weight', THEME.typography.title.weight)
        .style('fill', THEME.typography.title.color)
        .text(config.title || `${config.yAxis} Distribution`);

    // Center text elements with classes for easy selection
    svg.append('text')
        .attr('class', 'center-value')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '24px')
        .style('font-weight', 700)
        .style('fill', THEME.colors.dark)
        .style('opacity', 0)
        .text(total.toLocaleString())
        .transition()
        .delay(ANIMATION.duration)
        .duration(300)
        .style('opacity', 1);

    svg.append('text')
        .attr('class', 'center-label')
        .attr('x', width / 2)
        .attr('y', height / 2 + 28)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', THEME.colors.gray[500])
        .style('font-weight', 500)
        .style('opacity', 0)
        .text('Total')
        .transition()
        .delay(ANIMATION.duration + 100)
        .duration(300)
        .style('opacity', 1);

    const legend = svg.append('g')
        .attr('transform', `translate(${width - 200}, 100)`);

    chartData.forEach((d, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('opacity', 0)
            .style('cursor', 'pointer')
            .on('mouseover', function () {
                if (CHART_STATE.activePieSlice !== i) {
                    d3.select(this).select('rect')
                        .transition()
                        .duration(150)
                        .attr('width', 16)
                        .attr('height', 16);
                }
            })
            .on('mouseout', function () {
                if (CHART_STATE.activePieSlice !== i) {
                    d3.select(this).select('rect')
                        .transition()
                        .duration(150)
                        .attr('width', 12)
                        .attr('height', 12);
                }
            })
            .on('click', function () {
                // Toggle highlight on click
                if (CHART_STATE.activePieSlice === i) {
                    resetPieHighlight();
                    CHART_STATE.activePieSlice = null;
                } else {
                    highlightPieSlice(i);
                    CHART_STATE.activePieSlice = i;
                }
            });

        legendItem.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', getColor(i, 'pie'));

        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 10)
            .style('font-size', '12px')
            .style('fill', THEME.colors.gray[700])
            .style('font-weight', 500)
            .text(d.label);

        // Add value label next to legend
        legendItem.append('text')
            .attr('x', 180)
            .attr('y', 10)
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('fill', THEME.colors.gray[500])
            .style('font-weight', 600)
            .style('opacity', 0)
            .attr('data-index', i)
            .attr('class', 'legend-value')
            .text(d3.format(',.2f')(d.value));

        legendItem.transition()
            .delay(ANIMATION.duration + i * 50)
            .duration(300)
            .style('opacity', 1);
    });

    // Helper functions for highlighting
    function highlightPieSlice(sliceIndex) {
        // Highlight selected slice
        paths.transition()
            .duration(200)
            .attr('opacity', (d, i) => i === sliceIndex ? 1 : 0.3)
            .attr('transform', (d, i) => i === sliceIndex ? 'scale(1.05)' : 'scale(1)');

        // Show value on legend
        legend.selectAll('.legend-value')
            .transition()
            .duration(200)
            .style('opacity', (d, i) => i === sliceIndex ? 1 : 0);

        // Update center text with selected value
        const selectedValue = chartData[sliceIndex].value;
        const percentage = ((selectedValue / total) * 100).toFixed(1);

        svg.select('.center-value')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(selectedValue.toLocaleString())
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        svg.select('.center-label')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(`${chartData[sliceIndex].label} (${percentage}%)`)
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        // Highlight legend item
        legend.selectAll('g')
            .select('rect')
            .transition()
            .duration(200)
            .attr('width', (d, i) => i === sliceIndex ? 16 : 12)
            .attr('height', (d, i) => i === sliceIndex ? 16 : 12);
    }

    function resetPieHighlight() {
        // Reset all slices
        paths.transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('transform', 'scale(1)');

        // Hide legend values
        legend.selectAll('.legend-value')
            .transition()
            .duration(200)
            .style('opacity', 0);

        // Reset center text
        svg.select('.center-value')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(total.toLocaleString())
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        svg.select('.center-label')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text('Total')
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        // Reset legend items
        legend.selectAll('g')
            .select('rect')
            .transition()
            .duration(200)
            .attr('width', 12)
            .attr('height', 12);
    }

    return true;
}

function createDonutChart(container, data, config) {
    const { svg, width } = createChartSVG(container, 550);
    const height = 550;
    const radius = Math.min(width, height) / 2 - 80;
    const innerRadius = radius * 0.6;
    const centerX = width / 2;
    const centerY = height / 2;

    const chartData = processChartData(data, { ...config, chartType: 'donut' });
    if (chartData.length === 0) return false;

    const total = d3.sum(chartData, d => d.value);
    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const arcs = pie(chartData);

    const g = svg.append('g')
        .attr('transform', `translate(${centerX},${centerY})`);

    const slices = g.selectAll('.slice')
        .data(arcs)
        .enter()
        .append('path')
        .attr('class', 'slice')
        .attr('d', arc)
        .attr('fill', (d, i) => getColor(i, 'donut'))
        .attr('stroke', THEME.colors.light)
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('opacity', 0)
        .on('mouseover', function (event, d) {
            if (CHART_STATE.activeDonutSlice !== d.index) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke-width', 3)
                    .attr('stroke', THEME.colors.gray[300]);
            }

            const percentage = (d.data.value / total * 100).toFixed(1);
            showTooltip(event, `
                <div style="margin-bottom: 4px; font-weight: 600; color: ${THEME.colors.dark}">${d.data.label}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${getColor(d.index, 'donut')}; border-radius: 2px;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">Value:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.data.value)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <span style="color: ${THEME.colors.gray[600]}">Percentage:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.primary}">${percentage}%</span>
                </div>
            `);
        })
        .on('mouseout', function (event, d) {
            if (CHART_STATE.activeDonutSlice !== d.index) {
                d3.select(this)
                    .transition()
                    .duration(150)
                    .attr('stroke-width', 2)
                    .attr('stroke', THEME.colors.light);
            }
            hideTooltip();
        })
        .on('click', function (event, d) {
            // Toggle highlight on slice click
            if (CHART_STATE.activeDonutSlice === d.index) {
                resetDonutHighlight();
                CHART_STATE.activeDonutSlice = null;
            } else {
                highlightDonutSlice(d.index);
                CHART_STATE.activeDonutSlice = d.index;
            }
        });

    slices.transition()
        .delay((d, i) => i * 100)
        .duration(ANIMATION.duration)
        .ease(ANIMATION.easing)
        .attrTween('d', function (d) {
            const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function (t) {
                return arc(interpolate(t));
            };
        })
        .attr('opacity', 1);

    // Center text elements
    svg.append('text')
        .attr('class', 'donut-center-value')
        .attr('x', width / 2)
        .attr('y', height / 2 - 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '28px')
        .style('font-weight', 700)
        .style('fill', THEME.colors.dark)
        .style('opacity', 0)
        .text(total.toLocaleString())
        .transition()
        .delay(ANIMATION.duration)
        .duration(300)
        .style('opacity', 1);

    svg.append('text')
        .attr('class', 'donut-center-label')
        .attr('x', width / 2)
        .attr('y', height / 2 + 15)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', THEME.colors.gray[500])
        .style('font-weight', 500)
        .style('opacity', 0)
        .text('Total')
        .transition()
        .delay(ANIMATION.duration + 100)
        .duration(300)
        .style('opacity', 1);

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', `${THEME.typography.title.size}px`)
        .style('font-weight', THEME.typography.title.weight)
        .style('fill', THEME.typography.title.color)
        .text(config.title || `Donut Chart: ${config.yAxis}`);

    const innerCircle = svg.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', innerRadius)
        .attr('fill', THEME.colors.light)
        .attr('stroke', THEME.colors.gray[200])
        .attr('stroke-width', 1)
        .style('opacity', 0);

    innerCircle.transition()
        .delay(ANIMATION.duration)
        .duration(300)
        .style('opacity', 1);

    // LEGEND FOR DONUT CHART
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 200}, 100)`);

    chartData.forEach((d, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('opacity', 0)
            .style('cursor', 'pointer')
            .on('mouseover', function () {
                if (CHART_STATE.activeDonutSlice !== i) {
                    d3.select(this).select('rect')
                        .transition()
                        .duration(150)
                        .attr('width', 16)
                        .attr('height', 16);
                }
            })
            .on('mouseout', function () {
                if (CHART_STATE.activeDonutSlice !== i) {
                    d3.select(this).select('rect')
                        .transition()
                        .duration(150)
                        .attr('width', 12)
                        .attr('height', 12);
                }
            })
            .on('click', function () {
                // Toggle highlight on click
                if (CHART_STATE.activeDonutSlice === i) {
                    resetDonutHighlight();
                    CHART_STATE.activeDonutSlice = null;
                } else {
                    highlightDonutSlice(i);
                    CHART_STATE.activeDonutSlice = i;
                }
            });

        legendItem.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 12)
            .attr('height', 12)
            .attr('rx', 3)
            .attr('ry', 3)
            .attr('fill', getColor(i, 'donut'));

        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 10)
            .style('font-size', '12px')
            .style('fill', THEME.colors.gray[700])
            .style('font-weight', 500)
            .text(d.label);

        // Add value label next to legend
        legendItem.append('text')
            .attr('x', 180)
            .attr('y', 10)
            .attr('text-anchor', 'end')
            .style('font-size', '12px')
            .style('fill', THEME.colors.gray[500])
            .style('font-weight', 600)
            .style('opacity', 0)
            .attr('data-index', i)
            .attr('class', 'donut-legend-value')
            .text(d3.format(',.2f')(d.value));

        legendItem.transition()
            .delay(ANIMATION.duration + i * 50)
            .duration(300)
            .style('opacity', 1);
    });

    // Helper functions for donut chart highlighting
    function highlightDonutSlice(sliceIndex) {
        // Highlight selected slice
        slices.transition()
            .duration(200)
            .attr('opacity', (d, i) => i === sliceIndex ? 1 : 0.3)
            .attr('transform', (d, i) => i === sliceIndex ? 'scale(1.05)' : 'scale(1)');

        // Show value on legend
        legend.selectAll('.donut-legend-value')
            .transition()
            .duration(200)
            .style('opacity', (d, i) => i === sliceIndex ? 1 : 0);

        // Update center text with selected value
        const selectedValue = chartData[sliceIndex].value;
        const percentage = ((selectedValue / total) * 100).toFixed(1);

        svg.select('.donut-center-value')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(selectedValue.toLocaleString())
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        svg.select('.donut-center-label')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(`${chartData[sliceIndex].label} (${percentage}%)`)
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        // Highlight legend item
        legend.selectAll('g')
            .select('rect')
            .transition()
            .duration(200)
            .attr('width', (d, i) => i === sliceIndex ? 16 : 12)
            .attr('height', (d, i) => i === sliceIndex ? 16 : 12);
    }

    function resetDonutHighlight() {
        // Reset all slices
        slices.transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('transform', 'scale(1)');

        // Hide legend values
        legend.selectAll('.donut-legend-value')
            .transition()
            .duration(200)
            .style('opacity', 0);

        // Reset center text
        svg.select('.donut-center-value')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(total.toLocaleString())
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        svg.select('.donut-center-label')
            .transition()
            .duration(200)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text('Total')
                    .transition()
                    .duration(200)
                    .style('opacity', 1);
            });

        // Reset legend items
        legend.selectAll('g')
            .select('rect')
            .transition()
            .duration(200)
            .attr('width', 12)
            .attr('height', 12);
    }

    return true;
}

function createScatterPlot(container, data, config) {
    const { svg, width } = createChartSVG(container, 550);
    const height = 550;
    const margin = { top: 80, right: 40, bottom: 120, left: 90 };

    const chartData = processChartData(data, { ...config, chartType: 'scatter' });
    if (chartData.length === 0) return false;

    const x = d3.scaleLinear()
        .domain(d3.extent(chartData, d => d.x))
        .nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(chartData, d => d.y))
        .nice()
        .range([height - margin.bottom, margin.top]);

    addGridLines(svg, x, y, width, height, margin);

    const sizeScale = d3.scaleSqrt()
        .domain(d3.extent(chartData, d => d.y))
        .range([4, 12]);

    const points = svg.selectAll('.point')
        .data(chartData)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', margin.left)
        .attr('cy', height - margin.bottom)
        .attr('r', 0)
        .attr('fill', THEME.colors.primary)
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'white')
        .attr('stroke-width', 1.5)
        .on('mouseover', function (event, d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', sizeScale(d.y) * 1.4)
                .attr('fill-opacity', 1.0)
                .attr('stroke', THEME.colors.gray[700]);

            showTooltip(event, `
                <div style="margin-bottom: 4px; font-weight: 600; color: ${THEME.colors.dark}">Data Point</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${THEME.colors.primary}; border-radius: 50%;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">${config.xAxis}:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.x)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <div style="width: 12px; height: 12px; background: ${THEME.colors.secondary}; border-radius: 50%;"></div>
                    <span style="color: ${THEME.colors.gray[600]}">${config.yAxis}:</span>
                    <span style="font-weight: 700; color: ${THEME.colors.dark}">${d3.format(',.2f')(d.y)}</span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: ${THEME.colors.gray[500]}">
                    Correlation between ${config.xAxis} and ${config.yAxis}
                </div>
            `);
        })
        .on('mouseout', function (event, d) {
            d3.select(this)
                .transition()
                .duration(150)
                .attr('r', sizeScale(d.y))
                .attr('fill-opacity', 0.7)
                .attr('stroke', 'white');
            hideTooltip();
        });

    points.transition()
        .delay((d, i) => (i / chartData.length) * ANIMATION.duration)
        .duration(300)
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', d => sizeScale(d.y));

    // Trend line
    if (chartData.length > 2) {
        const xValues = chartData.map(d => d.x);
        const yValues = chartData.map(d => d.y);
        const n = xValues.length;

        const xMean = d3.mean(xValues);
        const yMean = d3.mean(yValues);
        const numerator = d3.sum(xValues.map((xi, i) => (xi - xMean) * (yValues[i] - yMean)));
        const denominator = d3.sum(xValues.map(xi => Math.pow(xi - xMean, 2)));
        const slope = denominator !== 0 ? numerator / denominator : 0;
        const intercept = yMean - slope * xMean;

        const line = d3.line()
            .x(d => x(d.x))
            .y(d => y(slope * d.x + intercept))
            .curve(d3.curveLinear);

        const trendLine = svg.append('path')
            .datum([{ x: d3.min(xValues), y: d3.min(xValues) * slope + intercept }, { x: d3.max(xValues), y: d3.max(xValues) * slope + intercept }])
            .attr('class', 'trend-line')
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', THEME.colors.danger)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .style('opacity', 0);

        trendLine.transition()
            .delay(ANIMATION.duration)
            .duration(500)
            .style('opacity', 0.7);
    }

    const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.format(',.0f')));

    const yAxis = svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d3.format(',.0f')));

    xAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight);

    yAxis.selectAll('text')
        .style('font-size', `${THEME.typography.axisLabel.size}px`)
        .style('fill', THEME.typography.axisLabel.color)
        .style('font-weight', THEME.typography.axisLabel.weight);

    addChartLabels(svg, width, height, margin, config);
    return true;
}

// --- Unified Exporter ---
function generateChart(container, data, chartType, config) {
    if (!container) return false;
    hideTooltip();

    let success = false;
    try {
        switch (chartType) {
            case 'bar': success = createBarChart(container, data, config); break;
            case 'line': success = createLineChart(container, data, config); break;
            case 'pie': success = createPieChart(container, data, config); break;
            case 'donut': success = createDonutChart(container, data, config); break;
            case 'scatter': success = createScatterPlot(container, data, config); break;
            default:
                console.warn('Unsupported chart type:', chartType);
                return false;
        }
    } catch (error) {
        console.error('Chart generation failed:', error);
        Swal.fire({
            icon: 'error',
            title: 'Chart Generation Failed',
            text: 'An error occurred while creating the visualization. Please try again.',
            confirmButtonColor: THEME.colors.danger,
        });
        return false;
    }

    return success;
}

// --- EXPORTED FUNCTIONS ---
export {
    generateChart,
    clearChart,
    processChartData,
    exportChartAsSVG,
    exportChartAsPNG
};