// Firebase configuration and app state
let db = null;
let chartsMap = {};
let currentData = {};
let limits = {
    upper: 100,
    lower: 0
};

// Initialize Firebase
function initializeFirebase() {
    const configText = document.getElementById('firebase-config').value;
    const statusElement = document.getElementById('connection-status');
    
    try {
        const config = JSON.parse(configText);
        
        // Initialize Firebase with the provided config
        const app = firebase.initializeApp(config);
        db = firebase.database(app);
        
        statusElement.textContent = 'Connected';
        statusElement.classList.add('connected');
        statusElement.classList.remove('disconnected');
        showMessage('Connected to Firebase successfully!', 'success');
    } catch (error) {
        statusElement.textContent = 'Connection Failed';
        statusElement.classList.add('disconnected');
        statusElement.classList.remove('connected');
        showMessage('Error connecting to Firebase: ' + error.message, 'error');
    }
}

// Load device data
function loadDeviceData() {
    if (!db) {
        showMessage('Please connect to Firebase first', 'error');
        return;
    }
    
    const deviceId = document.getElementById('device-id').value;
    if (!deviceId) {
        showMessage('Please enter a Device ID', 'error');
        return;
    }
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const path = `Devices/${deviceId}/historical_data/${year}/${month}/${day}`;
    loadDataFromPath(path);
}

// Load data for specific date
function loadDataForDate() {
    if (!db) {
        showMessage('Please connect to Firebase first', 'error');
        return;
    }
    
    const deviceId = document.getElementById('device-id').value;
    const datePicker = document.getElementById('date-picker').value;
    
    if (!deviceId) {
        showMessage('Please enter a Device ID', 'error');
        return;
    }
    
    if (!datePicker) {
        showMessage('Please select a date', 'error');
        return;
    }
    
    const [year, month, day] = datePicker.split('-');
    const path = `Devices/${deviceId}/historical_data/${year}/${month}/${day}`;
    loadDataFromPath(path);
}

// Generic function to load data from a path
function loadDataFromPath(path) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = '<div class="loading">Loading data...</div>';
    
    db.ref(path).on('value', (snapshot) => {
        if (snapshot.exists()) {
            const hourlyData = snapshot.val();
            processAndDisplayData(hourlyData);
        } else {
            chartsContainer.innerHTML = '<div class="error">No data found for the specified path.</div>';
        }
    }, (error) => {
        chartsContainer.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
    });
}

// Process data and create charts
function processAndDisplayData(hourlyData) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = '';
    chartsMap = {};
    currentData = {};
    
    // Group data by hour and collect all data points
    const dataByHour = {};
    
    Object.entries(hourlyData).forEach(([hour, hourData]) => {
        if (typeof hourData === 'object') {
            dataByHour[hour] = hourData;
        }
    });
    
    // Create charts for each data point (data01-data10)
    for (let i = 1; i <= 10; i++) {
        const dataKey = `data${String(i).padStart(2, '0')}`;
        const chartData = extractDataForKey(dataByHour, dataKey);
        
        if (chartData && chartData.timestamps.length > 0) {
            createChart(chartsContainer, dataKey, chartData);
            currentData[dataKey] = chartData;
        }
    }
    
    if (Object.keys(chartsMap).length === 0) {
        chartsContainer.innerHTML = '<div class="error">No valid data points found. Expected data01-data10 keys in the database.</div>';
    }
}

// Extract data for a specific key from hourly data
function extractDataForKey(dataByHour, dataKey) {
    const timestamps = [];
    const values = [];
    const sortedHours = Object.keys(dataByHour).sort();
    
    sortedHours.forEach((hour) => {
        const hourData = dataByHour[hour];
        if (hourData && hourData[dataKey] !== undefined) {
            timestamps.push(hour);
            values.push(parseFloat(hourData[dataKey]));
        }
    });
    
    return {
        timestamps,
        values,
        dataKey
    };
}

// Create a chart for a data key
function createChart(container, dataKey, chartData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';
    
    const title = document.createElement('h4');
    title.textContent = dataKey.toUpperCase();
    wrapper.appendChild(title);
    
    const canvasDiv = document.createElement('div');
    canvasDiv.className = 'chart-canvas';
    
    const canvas = document.createElement('canvas');
    canvasDiv.appendChild(canvas);
    wrapper.appendChild(canvasDiv);
    container.appendChild(wrapper);
    
    // Prepare chart data with colored regions based on limits
    const chartConfig = {
        type: 'line',
        data: {
            labels: chartData.timestamps,
            datasets: [
                {
                    label: dataKey.toUpperCase(),
                    data: chartData.values,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.1
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy'
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        modifierKey: 'ctrl'
                    },
                    limits: {
                        x: { min: 'original', max: 'original' },
                        y: { min: 'original', max: 'original' }
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    displayColors: true,
                    borderColor: '#ccc',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time (HH:MM)'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    };
    
    // Add background color plugin
    if (chartConfig.options.plugins === undefined) {
        chartConfig.options.plugins = {};
    }
    
    const chart = new Chart(canvas, chartConfig);
    chartsMap[dataKey] = { chart, canvas, wrapper };
    
    // Add limit lines and background regions
    updateLimitLines(dataKey);
}

// Update limits
function updateLimits() {
    const upperLimit = parseFloat(document.getElementById('upper-limit').value);
    const lowerLimit = parseFloat(document.getElementById('lower-limit').value);
    
    if (isNaN(upperLimit) || isNaN(lowerLimit)) {
        showMessage('Please enter valid limit values', 'error');
        return;
    }
    
    if (lowerLimit >= upperLimit) {
        showMessage('Lower limit must be less than upper limit', 'error');
        return;
    }
    
    limits.upper = upperLimit;
    limits.lower = lowerLimit;
    
    updateCharts();
    showMessage('Limits updated successfully!', 'success');
}

// Update all charts with new limits and settings
function updateCharts() {
    Object.keys(chartsMap).forEach(dataKey => {
        updateLimitLines(dataKey);
    });
}

// Update limit lines and background for a specific chart
function updateLimitLines(dataKey) {
    if (!chartsMap[dataKey]) return;
    
    const chart = chartsMap[dataKey].chart;
    const showLimits = document.getElementById('show-limits').checked;
    const showBackground = document.getElementById('show-background').checked;
    
    // Remove existing limit datasets
    chart.data.datasets = chart.data.datasets.filter(ds => !ds.label.includes('Limit') && !ds.label.includes('Region'));
    
    if (showLimits) {
        // Add upper limit line
        chart.data.datasets.push({
            label: 'Upper Limit',
            data: Array(chart.data.labels.length).fill(limits.upper),
            borderColor: '#e74c3c',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0
        });
        
        // Add lower limit line
        chart.data.datasets.push({
            label: 'Lower Limit',
            data: Array(chart.data.labels.length).fill(limits.lower),
            borderColor: '#3498db',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0
        });
    }
    
    // Update chart with background regions if needed
    if (showBackground) {
        addBackgroundRegions(chart);
    }
    
    chart.update();
}

// Add background color regions
function addBackgroundRegions(chart) {
    const ctx = chart.ctx;
    const yScale = chart.scales.y;
    const xScale = chart.scales.x;
    
    if (!yScale || !xScale) return;
    
    const aboveColor = document.getElementById('above-color').value;
    const normalColor = document.getElementById('normal-color').value;
    const belowColor = document.getElementById('below-color').value;
    
    // Store original draw function
    const originalDraw = Chart.controllers.line.prototype.draw;
    
    Chart.controllers.line.prototype.draw = function (relRenderIndex, relRenderInfo) {
        originalDraw.call(this, relRenderIndex, relRenderInfo);
        
        const yScale = this.chart.scales.y;
        const xScale = this.chart.scales.x;
        const chartArea = this.chart.chartArea;
        
        if (!yScale || !xScale) return;
        
        ctx.save();
        
        // Draw background regions
        const upperPixel = yScale.getPixelForValue(limits.upper);
        const lowerPixel = yScale.getPixelForValue(limits.lower);
        
        // Above upper limit
        ctx.fillStyle = hexToRgba(aboveColor, 0.1);
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, upperPixel - chartArea.top);
        
        // Between limits (normal)
        ctx.fillStyle = hexToRgba(normalColor, 0.1);
        ctx.fillRect(chartArea.left, upperPixel, chartArea.width, lowerPixel - upperPixel);
        
        // Below lower limit
        ctx.fillStyle = hexToRgba(belowColor, 0.1);
        ctx.fillRect(chartArea.left, lowerPixel, chartArea.width, chartArea.bottom - lowerPixel);
        
        ctx.restore();
    };
}

// Convert hex color to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Reset zoom on all charts
function resetZoom() {
    Object.values(chartsMap).forEach(({ chart }) => {
        chart.resetZoom();
    });
}

// Show message to user
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error' : 'success';
    messageDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Set today's date as default in date picker
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('date-picker').value = `${year}-${month}-${day}`;
});
