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
            showMessage('Firebase config not found', 'error');
            return;
        }

        console.log('Initializing Firebase...');
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log('Firebase initialized');
        updateConnectionStatus(true, 'Connecting...');
        
        // Test connection by reading root data
        const timeoutId = setTimeout(() => {
            console.warn('Connection timeout - check Firebase database');
            updateConnectionStatus(false, 'Connection timeout');
            showMessage('Connection timeout - Check Firebase permissions and database URL', 'error');
        }, 10000);

        db.ref('/').limitToFirst(1).once('value')
            .then((snapshot) => {
                clearTimeout(timeoutId);
                console.log('Firebase connection test successful');
                updateConnectionStatus(true, 'Connected');
                
                // Now load devices
                loadDevicesList();
            })
            .catch(error => {
                clearTimeout(timeoutId);
                console.error('Connection test failed:', error);
                updateConnectionStatus(false, 'Connection failed');
                showMessage('Error: ' + error.message, 'error');
            });
        
    } catch (error) {
        console.error('Firebase initialization error:', error);
        updateConnectionStatus(false, 'Initialization error');
        showMessage('Firebase Error: ' + error.message, 'error');
    }
}

// Load devices list
function loadDevicesList() {
    if (!db) {
        console.error('Database not available');
        return;
    }

    console.log('Loading devices list...');
    const timeoutId = setTimeout(() => {
        console.warn('Device list loading timeout');
        updateConnectionStatus(false, 'Device load timeout');
        showMessage('Timeout loading devices', 'error');
    }, 10000);

    db.ref('Devices').once('value')
        .then((snapshot) => {
            clearTimeout(timeoutId);
            console.log('Devices snapshot received, exists:', snapshot.exists());
            
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
                populateDeviceSelect([]); // Show empty dropdown
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading devices:', error);
            updateConnectionStatus(false, 'Failed to load devices');
            showMessage('Error: ' + error.message, 'error');
        });
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
        statusDot.classList.add('error');
        connectionText.textContent = message;
        connectionTime.textContent = `(${connectionStatus.lastUpdate.toLocaleTimeString()})`;
    }
}

// Populate device dropdown
function populateDeviceSelect(devices = null) {
    const select = document.getElementById('device-select');
    if (!select) {
        console.error('device-select element not found');
        return;
    }
    
    const devList = devices !== null ? devices : deviceList;
    select.innerHTML = '<option value="">Select a device...</option>';
    
    if (devList.length === 0) {
        console.log('No devices to populate');
        return;
    }
    
    devList.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        select.appendChild(option);
    });
    
    if (devList.length > 0) {
        console.log('Auto-selecting first device:', devList[0]);
        select.value = devList[0];
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
            dateSelect.innerHTML = '<option value="">Select a device first</option>';
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
        
    dateSelect.innerHTML = '<option value="">Loading dates...</option>';
    console.log('Loading dates for device:', selectedDevice);
    
    const timeoutId = setTimeout(() => {
        console.warn('Date loading timeout');
        dateSelect.innerHTML = '<option value="">Failed to load dates</option>';
        showMessage('Timeout loading dates', 'error');
    }, 10000);
    
    db.ref(`Devices/${selectedDevice}/historical_data`)
        .once('value')
        .then((snapshot) => {
            clearTimeout(timeoutId);
            console.log('Dates snapshot received, exists:', snapshot.exists());
            
            if (snapshot.exists()) {
                const yearData = snapshot.val();
                const dates = [];
                
                // Extract all dates in YYYY-MM-DD format
                try {
                    Object.keys(yearData).forEach(year => {
                        if (typeof yearData[year] === 'object') {
                            Object.keys(yearData[year]).forEach(month => {
                                if (typeof yearData[year][month] === 'object') {
                                    Object.keys(yearData[year][month]).forEach(day => {
                                        dates.push(`${year}-${month}-${day}`);
                                    });
                                }
                            });
                        }
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
                        showMessage(`✓ Found ${dates.length} date(s) - Select and load data`, 'success');
                    } else {
                        showMessage('No dates available for this device', 'error');
                        const loadButton = document.getElementById('load-button');
                        if (loadButton) {
                            loadButton.disabled = true;
                        }
                    }
                } catch (e) {
                    console.error('Error parsing dates:', e);
                    showMessage('Error parsing date structure: ' + e.message, 'error');
                    dateSelect.innerHTML = '<option value="">Error parsing dates</option>';
                }
            } else {
                console.warn('No historical data found');
                showMessage('No historical data found for this device', 'error');
                dateSelect.innerHTML = '<option value="">No data available</option>';
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
            dateSelect.innerHTML = '<option value="">Error loading dates</option>';
        });
}

// Populate date dropdown
function populateDateSelect(dates) {
    const select = document.getElementById('date-select');
    if (!select) return;
        
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
        chartsContainer.innerHTML = '<div class="loading">📊 Loading chart data...</div>';
    }
        
    const timeoutId = setTimeout(() => {
        console.warn('Data loading timeout');
        if (chartsContainer) {
            chartsContainer.innerHTML = '<div class="error">Timeout loading data</div>';
        }
    }, 15000);
    
    db.ref(path)
        .once('value')
        .then((snapshot) => {
            clearTimeout(timeoutId);
            console.log('Data snapshot received, exists:', snapshot.exists());
            
            if (snapshot.exists()) {
                const hourlyData = snapshot.val();
                processAndDisplayData(hourlyData);
                updateLastUpdated();
            } else {
                if (chartsContainer) {
                    chartsContainer.innerHTML = '<div class="error">No data found for the specified date.</div>';
                }
            }
        })        
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading data:', error);
            if (chartsContainer) {
                chartsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        });
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const element = document.getElementById('last-updated');
    if (element) {
        element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

// Process data and create charts
function processAndDisplayData(hourlyData) {
    const chartsContainer = document.getElementById('charts-container');
    if (!chartsContainer) return;
        
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
    } else {
        console.log(`Created ${Object.keys(chartsMap).length} charts`);
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
    showMessage(`✓ Limits updated: ${lowerLimit} - ${upperLimit}`, 'success');
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
    const showLimits = document.getElementById('show-limits');
    const showBackground = document.getElementById('show-background');
    
    if (!showLimits || !showBackground) return;
        
    // Remove existing limit datasets
    chart.data.datasets = chart.data.datasets.filter(ds => !ds.label.includes('Limit'));
    
    if (showLimits.checked) {
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
    if (showBackground.checked) {
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
    
    const aboveColor = document.getElementById('above-color');
    const normalColor = document.getElementById('normal-color');
    const belowColor = document.getElementById('below-color');
    
    if (!aboveColor || !normalColor || !belowColor) return;
    
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
        ctx.fillStyle = hexToRgba(aboveColor.value, 0.15);
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, upperPixel - chartArea.top);
        
        // Between limits (normal)
        ctx.fillStyle = hexToRgba(normalColor.value, 0.15);
        ctx.fillRect(chartArea.left, upperPixel, chartArea.width, lowerPixel - upperPixel);
        
        // Below lower limit
        ctx.fillStyle = hexToRgba(belowColor.value, 0.15);
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
    
    if (panel && button) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            button.textContent = 'Hide';
        } else {
            panel.classList.add('hidden');
            button.textContent = 'Show';
        }
    }
}

// Show message to user
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error' : 'success';
    messageDiv.textContent = message;
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(messageDiv, container.firstChild);
        setTimeout(() => {
            messageDiv.remove();
        }, 6000);
    }
}

console.log('App.js loaded successfully');
