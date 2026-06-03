// Firebase configuration and app state
let db = null;
let chartsMap = {};
let currentData = {};
let deviceList = [];
let userAccessibleDevices = [];
let selectedDevice = null;
let selectedDate = null;
let limits = {
    upper: 75,
    lower: 25
};

// Per-chart limits storage
let chartLimits = {};

// Current user session
let currentUser = null;

// Connection status tracking
let connectionStatus = {
    connected: false,
    lastUpdate: null
};

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, starting initialization');
    initializeFirebase();
});

// Initialize Firebase
function initializeFirebase() {
    try {
        if (typeof firebaseConfig === 'undefined') {
            console.error('Firebase config not found');
            showLoginMessage('Firebase config not found', 'error');
            return;
        }

        console.log('Initializing Firebase...');
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        console.log('Firebase initialized');
        updateLoginStatus('Firebase connected, ready for login');
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showLoginMessage('Firebase Error: ' + error.message, 'error');
    }
}

// Handle login
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showLoginMessage('Please enter both username and password', 'error');
        return;
    }
    
    updateLoginStatus('Authenticating...');
    const passwordHash = CryptoJS.SHA256(password).toString();
    
    authenticateUser(username, passwordHash);
}

// Authenticate user
function authenticateUser(username, passwordHash) {
    db.ref('Users').once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                showLoginMessage('No users found in database', 'error');
                updateLoginStatus('Authentication failed');
                return;
            }
            
            const usersData = snapshot.val();
            let foundUser = null;
            let foundUserId = null;
            
            // Search for user by name
            for (const userId in usersData) {
                const user = usersData[userId];
                if (user.name === username && user.password === passwordHash) {
                    foundUser = user;
                    foundUserId = userId;
                    break;
                }
            }
            
            if (!foundUser) {
                showLoginMessage('Invalid username or password', 'error');
                updateLoginStatus('Authentication failed');
                return;
            }
            
            // Authentication successful
            console.log('User authenticated:', foundUserId);
            currentUser = {
                id: foundUserId,
                name: foundUser.name,
                devices_access: foundUser.devices_access || {}
            };
            
            showLoginMessage(`Welcome, ${foundUser.name}!`, 'success');
            updateLoginStatus('Authentication successful');
            
            // Transition to viewer page
            setTimeout(() => {
                transitionToViewerPage();
            }, 1000);
        })
        .catch(error => {
            console.error('Authentication error:', error);
            showLoginMessage('Error: ' + error.message, 'error');
            updateLoginStatus('Authentication failed');
        });
}

// Transition to viewer page
function transitionToViewerPage() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('viewer-page').classList.remove('hidden');
    
    // Clear login form
    document.getElementById('login-form').reset();
    document.getElementById('login-message').textContent = '';
    document.getElementById('login-message').className = 'login-message';
    
    // Initialize viewer
    initializeViewer();
}

// Initialize viewer
function initializeViewer() {
    console.log('Initializing viewer for user:', currentUser.name);
    updateConnectionStatus(true, 'Connecting...');
    loadAllDevices();
}

// Load all available devices
function loadAllDevices() {
    if (!db) {
        console.error('Database not available');
        return;
    }
    
    console.log('Loading all devices...');
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
                console.log('All devices available:', deviceList);
                
                // Filter devices based on user access
                filterUserAccessibleDevices();
                updateConnectionStatus(true, 'Connected');
            } else {
                console.warn('No devices found in database');
                updateConnectionStatus(true, 'Connected (no devices)');
                showMessage('No devices found in database', 'error');
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('Error loading devices:', error);
            updateConnectionStatus(false, 'Failed to load devices');
            showMessage('Error: ' + error.message, 'error');
        });
}

// Filter devices based on user access
function filterUserAccessibleDevices() {
    userAccessibleDevices = [];
    const userDeviceAccess = currentUser.devices_access || {};
    
    console.log('User device access:', userDeviceAccess);
    
    // Check each device in user's access list
    for (const deviceId in userDeviceAccess) {
        // Verify the device exists in the main Devices list
        if (deviceList.includes(deviceId)) {
            userAccessibleDevices.push(deviceId);
        } else {
            console.warn(`Device ${deviceId} in user access list not found in main Devices`);
        }
    }
    
    console.log('User accessible devices:', userAccessibleDevices);
    
    if (userAccessibleDevices.length === 0) {
        showMessage('You do not have access to any devices', 'error');
        document.getElementById('device-select').innerHTML = '<option value="">No devices available</option>';
        return;
    }
    
    populateDeviceSelect(userAccessibleDevices);
    showMessage(`✓ Loaded ${userAccessibleDevices.length} device(s) you can access`, 'success');
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
    
    const devList = devices !== null ? devices : userAccessibleDevices;
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
    console.log('=== LOAD DATA START ===');
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
            console.log('Data snapshot received');
            console.log('Snapshot exists:', snapshot.exists());
            
            if (snapshot.exists()) {
                const hourlyData = snapshot.val();
                console.log('=== RAW DATA ===');
                console.log('Type of hourlyData:', typeof hourlyData);
                console.log('hourlyData:', hourlyData);
                console.log('Keys in hourlyData:', Object.keys(hourlyData));
                console.log('=== END RAW DATA ===');
                processAndDisplayData(hourlyData);
                updateLastUpdated();
                console.log('=== LOAD DATA END ===');
            } else {
                console.log('Snapshot does not exist');
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
    console.log('=== PROCESS DATA START ===');
    const chartsContainer = document.getElementById('charts-container');
    if (!chartsContainer) return;
    
    chartsContainer.innerHTML = '';
    chartsMap = {};
    currentData = {};
    chartLimits = {};
    
    const dataByHour = {};
    
    Object.entries(hourlyData).forEach(([hour, hourData]) => {
        if (typeof hourData === 'object' && hourData !== null) {
            dataByHour[hour] = hourData;
        }
    });
    
    const hourKeys = Object.keys(dataByHour);
    console.log('Number of hours:', hourKeys.length);
    console.log('Hour keys:', hourKeys);
    
    if (hourKeys.length === 0) {
        console.log('No hourly data found');
        chartsContainer.innerHTML = '<div class="error">No hourly data found</div>';
        return;
    }
    
    const firstHour = hourKeys[0];
    const firstHourData = dataByHour[firstHour];
    console.log('First hour:', firstHour);
    console.log('First hour data:', firstHourData);
    console.log('First hour data keys:', Object.keys(firstHourData || {}));
    
    let availableDataKeys = [];
    
    if (firstHourData && typeof firstHourData === 'object') {
        const allKeys = Object.keys(firstHourData);
        console.log('All keys in first hour:', allKeys);
        
        availableDataKeys = allKeys.filter(key => {
            const value = firstHourData[key];
            const isNumeric = typeof value === 'number' || 
                            (typeof value === 'string' && !isNaN(parseFloat(value)));
            console.log(`  Key "${key}": value=${value}, type=${typeof value}, isNumeric=${isNumeric}`);
            return isNumeric;
        });
    }
    
    console.log('Available numeric data keys:', availableDataKeys);
    
    availableDataKeys.forEach(dataKey => {
        const chartData = extractDataForKey(dataByHour, dataKey);
        
        if (chartData && chartData.timestamps.length > 0) {
            console.log(`Creating chart for ${dataKey}`);
            
            chartLimits[dataKey] = {
                upper: limits.upper,
                lower: limits.lower
            };
            
            createChart(chartsContainer, dataKey, chartData);
            currentData[dataKey] = chartData;
        }
    });
    
    if (Object.keys(chartsMap).length === 0) {
        chartsContainer.innerHTML = `<div class="error"><pre>No valid data points found.\n\nAvailable keys: ${availableDataKeys.join(', ') || 'none'}\n\nCheck browser console (F12) for detailed debug info.</pre></div>`;
    } else {
        console.log(`Created ${Object.keys(chartsMap).length} charts`);
    }
    console.log('=== PROCESS DATA END ===');
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
            const value = parseFloat(hourData[dataKey]);
            if (!isNaN(value)) {
                values.push(value);
            }
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
    
    const headerContainer = document.createElement('div');
    headerContainer.className = 'chart-header';
    
    const title = document.createElement('h4');
    title.textContent = dataKey.toUpperCase();
    headerContainer.appendChild(title);
    
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'chart-settings-btn';
    settingsBtn.textContent = '⚙️ Settings';
    settingsBtn.onclick = () => toggleChartLimitsPanel(dataKey);
    headerContainer.appendChild(settingsBtn);
    
    wrapper.appendChild(headerContainer);
    
    const limitsPanel = document.createElement('div');
    limitsPanel.className = 'chart-limits-panel hidden';
    limitsPanel.id = `limits-${dataKey}`;
    
    const limitsContent = document.createElement('div');
    limitsContent.className = 'chart-limits-content';
    
    const upperLimitDiv = document.createElement('div');
    upperLimitDiv.className = 'chart-limit-input';
    const upperLabel = document.createElement('label');
    upperLabel.textContent = 'Upper Limit:';
    const upperInput = document.createElement('input');
    upperInput.type = 'number';
    upperInput.value = chartLimits[dataKey]?.upper || 75;
    upperInput.step = '0.1';
    upperInput.id = `upper-limit-${dataKey}`;
    upperLimitDiv.appendChild(upperLabel);
    upperLimitDiv.appendChild(upperInput);
    
    const lowerLimitDiv = document.createElement('div');
    lowerLimitDiv.className = 'chart-limit-input';
    const lowerLabel = document.createElement('label');
    lowerLabel.textContent = 'Lower Limit:';
    const lowerInput = document.createElement('input');
    lowerInput.type = 'number';
    lowerInput.value = chartLimits[dataKey]?.lower || 25;
    lowerInput.step = '0.1';
    lowerInput.id = `lower-limit-${dataKey}`;
    lowerLimitDiv.appendChild(lowerLabel);
    lowerLimitDiv.appendChild(lowerInput);
    
    const applyBtn = document.createElement('button');
    applyBtn.className = 'apply-chart-limits-btn';
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => applyChartLimits(dataKey);
    
    limitsContent.appendChild(upperLimitDiv);
    limitsContent.appendChild(lowerLimitDiv);
    limitsContent.appendChild(applyBtn);
    
    limitsPanel.appendChild(limitsContent);
    wrapper.appendChild(limitsPanel);
    
    const canvasDiv = document.createElement('div');
    canvasDiv.className = 'chart-canvas';
    
    const canvas = document.createElement('canvas');
    canvasDiv.appendChild(canvas);
    wrapper.appendChild(canvasDiv);
    container.appendChild(wrapper);
    
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
    
    updateChartLimitLines(dataKey);
}

// Toggle chart limits panel visibility
function toggleChartLimitsPanel(dataKey) {
    const panel = document.getElementById(`limits-${dataKey}`);
    if (panel) {
        panel.classList.toggle('hidden');
    }
}

// Apply limits to a specific chart
function applyChartLimits(dataKey) {
    const upperInput = document.getElementById(`upper-limit-${dataKey}`);
    const lowerInput = document.getElementById(`lower-limit-${dataKey}`);
    
    if (!upperInput || !lowerInput) {
        showMessage('Limit inputs not found', 'error');
        return;
    }
    
    const upperLimit = parseFloat(upperInput.value);
    const lowerLimit = parseFloat(lowerInput.value);
    
    if (isNaN(upperLimit) || isNaN(lowerLimit)) {
        showMessage('Please enter valid limit values', 'error');
        return;
    }
    
    if (lowerLimit >= upperLimit) {
        showMessage('Lower limit must be less than upper limit', 'error');
        return;
    }
    
    chartLimits[dataKey] = {
        upper: upperLimit,
        lower: lowerLimit
    };
    
    updateChartLimitLines(dataKey);
    showMessage(`✓ Limits updated for ${dataKey}: ${lowerLimit} - ${upperLimit}`, 'success');
    toggleChartLimitsPanel(dataKey);
}

// Update limit lines for a specific chart
function updateChartLimitLines(dataKey) {
    if (!chartsMap[dataKey]) return;
    
    const chart = chartsMap[dataKey].chart;
    const showLimits = document.getElementById('show-limits');
    const showBackground = document.getElementById('show-background');
    
    if (!showLimits || !showBackground) return;
    
    const chartLimit = chartLimits[dataKey] || limits;
    
    chart.data.datasets = chart.data.datasets.filter(ds => !ds.label.includes('Limit'));
    
    if (showLimits.checked) {
        chart.data.datasets.push({
            label: 'Upper Limit',
            data: Array(chart.data.labels.length).fill(chartLimit.upper),
            borderColor: '#e74c3c',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0
        });
        
        chart.data.datasets.push({
            label: 'Lower Limit',
            data: Array(chart.data.labels.length).fill(chartLimit.lower),
            borderColor: '#3498db',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0
        });
    }
    
    if (showBackground.checked) {
        addBackgroundRegions(chart, chartLimit);
    }
    
    chart.update();
}

// Update limits (global)
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
        updateChartLimitLines(dataKey);
    });
}

// Add background color regions
function addBackgroundRegions(chart, chartLimit) {
    const canvas = chart.canvas;
    const ctx = chart.ctx;
    
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
        
        const upperPixel = yScale.getPixelForValue(chartLimit.upper);
        const lowerPixel = yScale.getPixelForValue(chartLimit.lower);
        
        ctx.fillStyle = hexToRgba(aboveColor.value, 0.15);
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, upperPixel - chartArea.top);
        
        ctx.fillStyle = hexToRgba(normalColor.value, 0.15);
        ctx.fillRect(chartArea.left, upperPixel, chartArea.width, lowerPixel - upperPixel);
        
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

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        selectedDevice = null;
        selectedDate = null;
        userAccessibleDevices = [];
        chartsMap = {};
        currentData = {};
        
        document.getElementById('viewer-page').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
        
        document.getElementById('login-form').reset();
        document.getElementById('login-message').textContent = '';
        document.getElementById('login-message').className = 'login-message';
        updateLoginStatus('Ready');
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

// Login page message functions
function showLoginMessage(message, type) {
    const messageDiv = document.getElementById('login-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `login-message ${type}`;
    }
}

function updateLoginStatus(status) {
    const statusDiv = document.getElementById('login-status');
    if (statusDiv) {
        statusDiv.textContent = status;
    }
}

console.log('App.js loaded successfully')
