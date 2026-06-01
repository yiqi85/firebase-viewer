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
    lastUpdate: null
};

// Initialize Firebase and auto-connect
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, starting initialization');
    initializeFirebaseAuto();
});

// Auto-initialize Firebase
function initializeFirebaseAuto() {
    try {
        // Check if firebaseConfig is available
        if (typeof firebaseConfig === 'undefined') {
            console.error('Firebase config not found');
            updateConnectionStatus(false, 'Firebase config not found');
            return;
        }

        console.log('Initializing Firebase...');
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        updateConnectionStatus(true, 'Connecting...');
        console.log('Firebase initialized, attempting to load devices...');

        // Add connection timeout
        const timeoutId = setTimeout(() => {
            console.warn('Connection timeout - check Firebase database');
            updateConnectionStatus(false, 'Connection timeout');
            showMessage('Connection timeout - Check Firebase permissions and database URL', 'error');
        }, 8000);

        // Try to load devices
        db.ref('Devices').once('value')
            .then((snapshot) => {
                clearTimeout(timeoutId);
                console.log('Device list loaded:', snapshot.exists());
                
                if (snapshot.exists()) {
                    deviceList = Object.keys(snapshot.val());
                    console.log('Devices found:', deviceList);
                    populateDeviceSelect();
                    updateConnectionStatus(true, 'Connected');
                    showMessage(`✓ Connected! Loaded ${deviceList.length} device(s)`, 'success');
                } else {
                    console.warn('No devices found in database');
                    updateConnectionStatus(true, 'Connected (no devices)');
                    showMessage('No devices found. Check your database structure.', 'error');
                }
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('Error loading devices:', error);
                updateConnectionStatus(false, 'Connection failed');
                showMessage('Error: ' + error.message, 'error');
                });
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        updateConnectionStatus(false, 'Initialization error');
        showMessage('Firebase Error: ' + error.message, 'error');
        }
}

// Update connection status indicator
function updateConnectionStatus(connected, message) {
    console.log('Status:', message);
    const statusDot = document.getElementById('status-dot');
    const connectionText = document.getElementById('connection-text');
    const connectionTime = document.getElementById('connection-time');
    
    if (!statusDot || !connectionText) {
        console.warn('Status elements not found');
        return;
    }
        
    connectionStatus.connected = connected;
    connectionStatus.lastUpdate = new Date();
    
    if (connected) {
        statusDot.classList.remove('connecting', 'error');
        statusDot.classList.add('connected');
        connectionText.textContent = message;
        connectionTime.textContent = `(${connectionStatus.lastUpdate.toLocaleTimeString()})`;
    } else {
        statusDot.classList.remove('connected');
        if (message.includes('Connecting')) {
            statusDot.classList.add('connecting');
        } else {
            statusDot.classList.add('error');\n        }
        connectionText.textContent = message;
        connectionTime.textContent = `(${connectionStatus.lastUpdate.toLocaleTimeString()})`;
    }
}

// Populate device dropdown
function populateDeviceSelect() {
    const select = document.getElementById('device-select');
    if (!select) {
        console.error('device-select element not found');
        return;
    }
    
    select.innerHTML = '<option value=\"\">Select a device...</option>';
    
    deviceList.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        select.appendChild(option);
    });
    
    if (deviceList.length > 0) {
        console.log('Auto-selecting first device:', deviceList[0]);
        select.value = deviceList[0];
        onDeviceChange();
        }
}

// Handle device selection change
function onDeviceChange() {
    const select = document.getElementById('device-select');
    selectedDevice = select ? select.value : null;
    console.log('Device changed to:', selectedDevice);
    
    if (!selectedDevice) {
        const dateSelect = document.getElementById('date-select');
        if (dateSelect) {
            dateSelect.innerHTML = '<option value=\"\">Select a device first</option>';
        }
        const loadButton = document.getElementById('load-button');
        if (loadButton) {
            loadButton.disabled = true;
        }
        return;
    }
    
    loadAvailableDates();
}

// Load available dates for selected device
function loadAvailableDates() {
    if (!db || !selectedDevice) {
        console.error('Database or device not available');
        showMessage('Please select a device', 'error');
        return;
    }
        
    const dateSelect = document.getElementById('date-select');
    if (!dateSelect) return;
        
    dateSelect.innerHTML = '<option value=\"\">Loading dates...</option>';
    console.log('Loading dates for device:', selectedDevice);
    
    const timeoutId = setTimeout(() => {
        console.warn('Date loading timeout');
        dateSelect.innerHTML = '<option value=\"\">Failed to load dates</option>';
        showMessage('Timeout loading dates', 'error');
    }, 8000);
    
    db.ref(`Devices/${selectedDevice}/historical_data`)
        .once('value')
        .then((snapshot) => {
            clearTimeout(timeoutId);
            console.log('Dates loaded:', snapshot.exists());
            
            if (snapshot.exists()) {
                const yearData = snapshot.val();
                const dates = [];
                
                // Extract all dates in YYYY-MM-DD format
                try {
                    Object.keys(yearData).forEach(year => {
                        Object.keys(yearData[year]).forEach(month => {
                            Object.keys(yearData[year][month]).forEach(day => {
                                dates.push(`${year}-${month}-${day}`);
                            });
                        });
                    });
                    
                    // Sort dates in descending order (latest first)
                    dates.sort().reverse();
                    console.log('Dates found:', dates.length);
                    
                    populateDateSelect(dates);
                    
                    if (dates.length > 0) {
                        const loadButton = document.getElementById('load-button');
                        if (loadButton) {
                            loadButton.disabled = false;
                        }
                        selectedDate = dates[0];
                        dateSelect.value = selectedDate;
                        showMessage(`✓ Found ${dates.length} date(s) - Loading latest data...`, 'success');
                        // Auto-load latest date
                        setTimeout(() => loadDataForSelection(), 500);
                    } else {
                        showMessage('No dates available for this device', 'error');
                        const loadButton = document.getElementById('load-button');
                        if (loadButton) {
                            loadButton.disabled = true;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing dates:', e);
                    showMessage('Error parsing date structure', 'error');
                }
            } else {
                console.warn('No historical data found');
                showMessage('No historical data found for this device', 'error');
                dateSelect.innerHTML = '<option value=\"\">No data available</option>';
                const loadButton = document.getElementById('load-button');
                if (loadButton) {
                    loadButton.disabled = true;
                }
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading dates:', error);
            showMessage('Error: ' + error.message, 'error');
            dateSelect.innerHTML = '<option value=\"\">Error loading dates</option>';
        });
}

// Populate date dropdown
function populateDateSelect(dates) {
    const select = document.getElementById('date-select');
    if (!select) return;
        
    select.innerHTML = '<option value=\"\">Select a date...</option>';
    
    dates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        select.appendChild(option);
    });
}    

// Handle date selection change
function onDateChange() {
    const select = document.getElementById('date-select');
    selectedDate = select ? select.value : null;
    console.log('Date changed to:', selectedDate);
}

// Load data for selected device and date
function loadDataForSelection() {
    if (!selectedDevice || !selectedDate) {
        console.error('Device or date not selected');
        showMessage('Please select both device and date', 'error');
        return;
    }
    
    const [year, month, day] = selectedDate.split('-');
    const path = `Devices/${selectedDevice}/historical_data/${year}/${month}/${day}`;
    console.log('Loading data from path:', path);
    
    const chartsContainer = document.getElementById('charts-container');
    if (chartsContainer) {
        chartsContainer.innerHTML = '<div class=\"loading\">📊 Loading chart data...</div>';
    }
        
    const timeoutId = setTimeout(() => {
        console.warn('Data loading timeout');
        if (chartsContainer) {
            chartsContainer.innerHTML = '<div class=\"error\">Timeout loading data</div>';
        }
    }, 15000);
    
    db.ref(path)
        .once('value')
        .then((snapshot) => {
            clearTimeout(timeoutId);
            console.log('Data loaded:', snapshot.exists());
            
            if (snapshot.exists()) {
                const hourlyData = snapshot.val();
                processAndDisplayData(hourlyData);
                updateLastUpdated();
            } else {
                if (chartsContainer) {
                    chartsContainer.innerHTML = '<div class=\"error\">No data found for the specified date.</div>';
                }
            }
        })        
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading data:', error);
            if (chartsContainer) {
                chartsContainer.innerHTML = `<div class=\"error\">Error: ${error.message}</div>`;
            }
        });
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = `Last updated: ${now.toLocaleTimeString()}`;\n    }\n}\n\n// Process data and create charts\nfunction processAndDisplayData(hourlyData) {\n    const chartsContainer = document.getElementById('charts-container');\n    if (!chartsContainer) return;\n\n    chartsContainer.innerHTML = '';\n    chartsMap = {};\n    currentData = {};\n\n    // Group data by hour\n    const dataByHour = {};\n\n    Object.entries(hourlyData).forEach(([hour, hourData]) => {\n        if (typeof hourData === 'object') {\n            dataByHour[hour] = hourData;\n        }\n    });\n\n    // Create charts for each data point (data01-data10)\n    for (let i = 1; i <= 10; i++) {\n        const dataKey = `data${String(i).padStart(2, '0')}`;\n        const chartData = extractDataForKey(dataByHour, dataKey);\n\n        if (chartData && chartData.timestamps.length > 0) {\n            createChart(chartsContainer, dataKey, chartData);\n            currentData[dataKey] = chartData;\n        }\n    }\n\n    if (Object.keys(chartsMap).length === 0) {\n        chartsContainer.innerHTML = '<div class=\"error\">No valid data points found (data01-data10).</div>';\n    } else {\n        console.log(`Created ${Object.keys(chartsMap).length} charts`);\n    }\n}\n\n// Extract data for a specific key from hourly data\nfunction extractDataForKey(dataByHour, dataKey) {\n    const timestamps = [];\n    const values = [];\n    const sortedHours = Object.keys(dataByHour).sort();\n\n    sortedHours.forEach((hour) => {\n        const hourData = dataByHour[hour];\n        if (hourData && hourData[dataKey] !== undefined) {\n            timestamps.push(hour);\n            values.push(parseFloat(hourData[dataKey]));\n        }\n    });\n\n    return {\n        timestamps,\n        values,\n        dataKey\n    };\n}\n\n// Create a chart for a data key\nfunction createChart(container, dataKey, chartData) {\n    const wrapper = document.createElement('div');\n    wrapper.className = 'chart-wrapper';\n\n    const title = document.createElement('h4');\n    title.textContent = dataKey.toUpperCase();\n    wrapper.appendChild(title);\n\n    const canvasDiv = document.createElement('div');\n    canvasDiv.className = 'chart-canvas';\n\n    const canvas = document.createElement('canvas');\n    canvasDiv.appendChild(canvas);\n    wrapper.appendChild(canvasDiv);\n    container.appendChild(wrapper);\n\n    // Prepare chart data\n    const chartConfig = {\n        type: 'line',\n        data: {\n            labels: chartData.timestamps,\n            datasets: [\n                {\n                    label: dataKey.toUpperCase(),\n                    data: chartData.values,\n                    borderColor: '#3498db',\n                    backgroundColor: 'rgba(52, 152, 219, 0.1)',\n                    borderWidth: 2,\n                    tension: 0.4,\n                    fill: false,\n                    pointRadius: 4,\n                    pointBackgroundColor: '#3498db',\n                    pointBorderColor: '#fff',\n                    pointBorderWidth: 2,\n                    pointHoverRadius: 6\n                }\n            ]\n        },\n        options: {\n            responsive: true,\n            maintainAspectRatio: false,\n            interaction: {\n                mode: 'index',\n                intersect: false\n            },\n            plugins: {\n                zoom: {\n                    zoom: {\n                        wheel: {\n                            enabled: true,\n                            speed: 0.1\n                        },\n                        pinch: {\n                            enabled: true\n                        },\n                        mode: 'xy'\n                    },\n                    pan: {\n                        enabled: true,\n                        mode: 'xy',\n                        modifierKey: 'ctrl'\n                    },\n                    limits: {\n                        x: { min: 'original', max: 'original' },\n                        y: { min: 'original', max: 'original' }\n                    }\n                },\n                legend: {\n                    display: true,\n                    position: 'top'\n                },\n                tooltip: {\n                    backgroundColor: 'rgba(0, 0, 0, 0.8)',\n                    padding: 12,\n                    titleFont: { size: 14, weight: 'bold' },\n                    bodyFont: { size: 13 },\n                    displayColors: true,\n                    borderColor: '#ccc',\n                    borderWidth: 1\n                }\n            },\n            scales: {\n                x: {\n                    display: true,\n                    title: {\n                        display: true,\n                        text: 'Time (HH:MM)'\n                    },\n                    ticks: {\n                        maxRotation: 45,\n                        minRotation: 0\n                    }\n                },\n                y: {\n                    display: true,\n                    title: {\n                        display: true,\n                        text: 'Value'\n                    }\n                }\n            }\n        }\n    };\n\n    const chart = new Chart(canvas, chartConfig);\n    chartsMap[dataKey] = { chart, canvas, wrapper };\n\n    // Add limit lines and background regions\n    updateLimitLines(dataKey);\n}\n\n// Update limits\nfunction updateLimits() {\n    const upperLimit = parseFloat(document.getElementById('upper-limit').value);\n    const lowerLimit = parseFloat(document.getElementById('lower-limit').value);\n\n    if (isNaN(upperLimit) || isNaN(lowerLimit)) {\n        showMessage('Please enter valid limit values', 'error');\n        return;\n    }\n\n    if (lowerLimit >= upperLimit) {\n        showMessage('Lower limit must be less than upper limit', 'error');\n        return;\n    }\n\n    limits.upper = upperLimit;\n    limits.lower = lowerLimit;\n\n    updateCharts();\n    showMessage(`✓ Limits updated: ${lowerLimit} - ${upperLimit}`, 'success');\n}\n\n// Update all charts\nfunction updateCharts() {\n    Object.keys(chartsMap).forEach(dataKey => {\n        updateLimitLines(dataKey);\n    });\n}\n\n// Update limit lines and background for a specific chart\nfunction updateLimitLines(dataKey) {\n    if (!chartsMap[dataKey]) return;\n\n    const chart = chartsMap[dataKey].chart;\n    const showLimits = document.getElementById('show-limits');\n    const showBackground = document.getElementById('show-background');\n\n    if (!showLimits || !showBackground) return;\n\n    // Remove existing limit datasets\n    chart.data.datasets = chart.data.datasets.filter(ds => !ds.label.includes('Limit'));\n\n    if (showLimits.checked) {\n        // Add upper limit line\n        chart.data.datasets.push({\n            label: 'Upper Limit',\n            data: Array(chart.data.labels.length).fill(limits.upper),\n            borderColor: '#e74c3c',\n            borderDash: [5, 5],\n            borderWidth: 2,\n            fill: false,\n            pointRadius: 0,\n            pointHoverRadius: 0,\n            tension: 0\n        });\n\n        // Add lower limit line\n        chart.data.datasets.push({\n            label: 'Lower Limit',\n            data: Array(chart.data.labels.length).fill(limits.lower),\n            borderColor: '#3498db',\n            borderDash: [5, 5],\n            borderWidth: 2,\n            fill: false,\n            pointRadius: 0,\n            pointHoverRadius: 0,\n            tension: 0\n        });\n    }\n\n    // Add background plugin for regions\n    if (showBackground.checked) {\n        addBackgroundRegions(chart);\n    }\n\n    chart.update();\n}\n\n// Add background color regions\nfunction addBackgroundRegions(chart) {\n    const canvas = chart.canvas;\n    const ctx = chart.ctx;\n\n    // Store reference for cleanup\n    if (!canvas._originalDraw) {\n        canvas._originalDraw = Chart.controllers.line.prototype.draw;\n    }\n\n    const aboveColor = document.getElementById('above-color');\n    const normalColor = document.getElementById('normal-color');\n    const belowColor = document.getElementById('below-color');\n\n    if (!aboveColor || !normalColor || !belowColor) return;\n\n    const originalDraw = canvas._originalDraw;\n\n    Chart.controllers.line.prototype.draw = function (relRenderIndex, relRenderInfo) {\n        originalDraw.call(this, relRenderIndex, relRenderInfo);\n\n        const yScale = this.chart.scales.y;\n        const xScale = this.chart.scales.x;\n        const chartArea = this.chart.chartArea;\n\n        if (!yScale || !xScale) return;\n\n        ctx.save();\n\n        // Draw background regions\n        const upperPixel = yScale.getPixelForValue(limits.upper);\n        const lowerPixel = yScale.getPixelForValue(limits.lower);\n\n        // Above upper limit\n        ctx.fillStyle = hexToRgba(aboveColor.value, 0.15);\n        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, upperPixel - chartArea.top);\n\n        // Between limits (normal)\n        ctx.fillStyle = hexToRgba(normalColor.value, 0.15);\n        ctx.fillRect(chartArea.left, upperPixel, chartArea.width, lowerPixel - upperPixel);\n\n        // Below lower limit\n        ctx.fillStyle = hexToRgba(belowColor.value, 0.15);\n        ctx.fillRect(chartArea.left, lowerPixel, chartArea.width, chartArea.bottom - lowerPixel);\n\n        ctx.restore();\n    };\n}\n\n// Convert hex color to rgba\nfunction hexToRgba(hex, alpha) {\n    const r = parseInt(hex.slice(1, 3), 16);\n    const g = parseInt(hex.slice(3, 5), 16);\n    const b = parseInt(hex.slice(5, 7), 16);\n    return `rgba(${r}, ${g}, ${b}, ${alpha})`;\n}\n\n// Reset zoom on all charts\nfunction resetZoom() {\n    Object.values(chartsMap).forEach(({ chart }) => {\n        chart.resetZoom();\n    });\n}\n\n// Toggle limits panel visibility\nfunction toggleLimitsPanel() {\n    const panel = document.getElementById('limits-panel');\n    const button = document.querySelector('.toggle-btn');\n    \n    if (panel && button) {\n        if (panel.classList.contains('hidden')) {\n            panel.classList.remove('hidden');\n            button.textContent = 'Hide';\n        } else {\n            panel.classList.add('hidden');\n            button.textContent = 'Show';\n        }\n    }\n}\n\n// Show message to user\nfunction showMessage(message, type) {\n    const messageDiv = document.createElement('div');\n    messageDiv.className = type === 'error' ? 'error' : 'success';\n    messageDiv.textContent = message;\n\n    const container = document.querySelector('.container');\n    if (container) {\n        container.insertBefore(messageDiv, container.firstChild);\n\n        setTimeout(() => {\n            messageDiv.remove();\n        }, 6000);\n    }\n}\n\nconsole.log('App.js loaded successfully');
