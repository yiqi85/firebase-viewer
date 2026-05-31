// Firebase configuration and app state
let db = null;
let chartsMap = {};
let currentData = {};
let deviceList = [];
let selectedDevice = null;
let selectedDate = null;
let limits = {
    upper: 75,
    lower: 25
};

// Connection status tracking
let connectionStatus = {
    connected: false,
    lastUpdate: null,
    attemptCount: 0,
    maxRetries: 3
};

// Initialize Firebase and auto-connect
window.addEventListener('DOMContentLoaded', () => {
    initializeFirebaseAuto();
    setDefaultDate();
});

// Auto-initialize Firebase
function initializeFirebaseAuto() {
    try {
        // Check if firebaseConfig is available
        if (typeof firebaseConfig === 'undefined') {
            updateConnectionStatus(false, 'Firebase config not found');
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        db = firebase.database();
        updateConnectionStatus(true, 'Connecting...');

        // Test connection and load device list
        db.ref().once('value', () => {
            updateConnectionStatus(true, 'Connected');
            loadDeviceList();
        }).catch(error => {
            updateConnectionStatus(false, 'Connection failed');
            console.error('Firebase connection error:', error);
        });

    } catch (error) {
        updateConnectionStatus(false, 'Initialization error');
        console.error('Firebase initialization error:', error);
    }
}

// Update connection status indicator
function updateConnectionStatus(connected, message) {
    const statusDot = document.getElementById('status-dot');
    const connectionText = document.getElementById('connection-text');
    const connectionTime = document.getElementById('connection-time');

    connectionStatus.connected = connected;
    connectionStatus.lastUpdate = new Date();

    if (connected) {
        statusDot.classList.remove('connecting', 'error');
        statusDot.classList.add('connected');
        connectionText.textContent = message;
        connectionTime.textContent = `(${connectionStatus.lastUpdate.toLocaleTimeString()})`;
    } else {
        statusDot.classList.remove('connected');
        if (message === 'Connecting...') {
            statusDot.classList.add('connecting');
        } else {
            statusDot.classList.add('error');
        }
        connectionText.textContent = message;
        connectionTime.textContent = `(${connectionStatus.lastUpdate.toLocaleTimeString()})`;
    }
}

// Load device list from Firebase
function loadDeviceList() {
    if (!db) {
        showMessage('Not connected to Firebase', 'error');
        return;
    }

    db.ref('Devices').once('value', (snapshot) => {
        if (snapshot.exists()) {
            deviceList = Object.keys(snapshot.val());
            populateDeviceSelect();
            showMessage(`Loaded ${deviceList.length} device(s)`, 'success');
        } else {
            showMessage('No devices found in database', 'error');
        }
    }).catch(error => {
        console.error('Error loading device list:', error);
        showMessage('Error loading device list: ' + error.message, 'error');
    });
}

// Populate device dropdown
function populateDeviceSelect() {
    const select = document.getElementById('device-select');
    select.innerHTML = '<option value="">Select a device...</option>';

    deviceList.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        select.appendChild(option);
    });

    if (deviceList.length > 0) {
        select.value = deviceList[0];
        onDeviceChange();
    }
}

// Handle device selection change
function onDeviceChange() {
    selectedDevice = document.getElementById('device-select').value;

    if (!selectedDevice) {
        document.getElementById('date-select').innerHTML = '<option value="">Select a device first</option>';
        document.getElementById('load-button').disabled = true;
        return;
    }

    loadAvailableDates();
}

// Load available dates for selected device
function loadAvailableDates() {
    if (!db || !selectedDevice) {
        showMessage('Please select a device', 'error');
        return;
    }

    const dateSelect = document.getElementById('date-select');
    dateSelect.innerHTML = '<option value="">Loading dates...</option>';

    db.ref(`Devices/${selectedDevice}/historical_data`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const yearData = snapshot.val();
            const dates = [];

            // Extract all dates in YYYY-MM-DD format
            Object.keys(yearData).forEach(year => {
                Object.keys(yearData[year]).forEach(month => {
                    Object.keys(yearData[year][month]).forEach(day => {
                        dates.push(`${year}-${month}-${day}`);
                    });
                });
            });

            // Sort dates in descending order (latest first)
            dates.sort().reverse();

            populateDateSelect(dates);

            if (dates.length > 0) {
                document.getElementById('load-button').disabled = false;
                selectedDate = dates[0];
                document.getElementById('date-select').value = selectedDate;
                showMessage(`Found ${dates.length} date(s) with data`, 'success');
                // Auto-load latest date
                loadDataForSelection();
            } else {
                showMessage('No dates available for this device', 'error');
                document.getElementById('load-button').disabled = true;
            }
        } else {
            showMessage('No historical data found for this device', 'error');
            dateSelect.innerHTML = '<option value="">No data available</option>';
            document.getElementById('load-button').disabled = true;
        }
    }).catch(error => {
        console.error('Error loading dates:', error);
        showMessage('Error loading dates: ' + error.message, 'error');
    });
}

// Populate date dropdown
function populateDateSelect(dates) {
    const select = document.getElementById('date-select');
    select.innerHTML = '<option value="">Select a date...</option>';

    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        select.appendChild(option);
    });
}

// Handle date selection change
function onDateChange() {
    selectedDate = document.getElementById('date-select').value;
}

// Load data for selected device and date
function loadDataForSelection() {
    if (!selectedDevice || !selectedDate) {
        showMessage('Please select both device and date', 'error');
        return;
    }

    const [year, month, day] = selectedDate.split('-');
    const path = `Devices/${selectedDevice}/historical_data/${year}/${month}/${day}`;

    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = '<div class="loading">Loading data...</div>';

    db.ref(path).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const hourlyData = snapshot.val();
            processAndDisplayData(hourlyData);
            updateLastUpdated();
        } else {
            chartsContainer.innerHTML = '<div class="error">No data found for the specified date.</div>';
        }
    }).catch(error => {
        chartsContainer.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
    });
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    document.getElementById('last-updated').textContent = 
        `Last updated: ${now.toLocaleTimeString()}`;
}

// Process data and create charts
function processAndDisplayData(hourlyData) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = '';
    chartsMap = {};
    currentData = {};

    // Group data by hour
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
        chartsContainer.innerHTML = '<div class="error">No valid data points found (data01-data10).</div>';
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

    // Prepare chart data
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
    showMessage(`Limits updated: ${lowerLimit} - ${upperLimit}`, 'success');
}

// Update all charts
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
    chart.data.datasets = chart.data.datasets.filter(ds => !ds.label.includes('Limit'));

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

    // Add background plugin for regions
    if (showBackground) {
        addBackgroundRegions(chart);
    }

    chart.update();
}

// Add background color regions
function addBackgroundRegions(chart) {
    const canvas = chart.canvas;
    const ctx = chart.ctx;

    // Store reference for cleanup
    if (!canvas._originalDraw) {
        canvas._originalDraw = Chart.controllers.line.prototype.draw;
    }

    const aboveColor = document.getElementById('above-color').value;
    const normalColor = document.getElementById('normal-color').value;
    const belowColor = document.getElementById('below-color').value;

    const originalDraw = canvas._originalDraw;

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
        ctx.fillStyle = hexToRgba(aboveColor, 0.15);
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, upperPixel - chartArea.top);

        // Between limits (normal)
        ctx.fillStyle = hexToRgba(normalColor, 0.15);
        ctx.fillRect(chartArea.left, upperPixel, chartArea.width, lowerPixel - upperPixel);

        // Below lower limit
        ctx.fillStyle = hexToRgba(belowColor, 0.15);
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

// Toggle limits panel visibility
function toggleLimitsPanel() {
    const panel = document.getElementById('limits-panel');
    const button = document.querySelector('.toggle-btn');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        button.textContent = 'Hide';
    } else {
        panel.classList.add('hidden');
        button.textContent = 'Show';
    }
}

// Set default date to today
function setDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('date-picker').value = `${year}-${month}-${day}`;
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