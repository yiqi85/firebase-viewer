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

// Process data and create charts
function processAndDisplayData(hourlyData) {
    console.log('=== PROCESS DATA START ===');
    const chartsContainer = document.getElementById('charts-container');
    if (!chartsContainer) return;
        
    chartsContainer.innerHTML = '';
    chartsMap = {};
    currentData = {};
    
    // Group data by hour
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
    
    // Get all available data keys from the first hour
    const firstHour = hourKeys[0];
    const firstHourData = dataByHour[firstHour];
    console.log('First hour:', firstHour);
    console.log('First hour data:', firstHourData);
    console.log('First hour data keys:', Object.keys(firstHourData || {}));
    
    let availableDataKeys = [];
    
    if (firstHourData && typeof firstHourData === 'object') {
        // Get all keys from the first hour
        const allKeys = Object.keys(firstHourData);
        console.log('All keys in first hour:', allKeys);
        
        // Filter to only numeric values
        availableDataKeys = allKeys.filter(key => {
            const value = firstHourData[key];
            const isNumeric = typeof value === 'number' || 
                            (typeof value === 'string' && !isNaN(parseFloat(value)));
            console.log(`  Key "${key}": value=${value}, type=${typeof value}, isNumeric=${isNumeric}`);
            return isNumeric;
        });
    }
    
    console.log('Available numeric data keys:', availableDataKeys);
    
    // Create charts for all available data keys
    availableDataKeys.forEach(dataKey => {
        const chartData = extractDataForKey(dataByHour, dataKey);
        
        if (chartData && chartData.timestamps.length > 0) {
            console.log(`Creating chart for ${dataKey}`);
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
