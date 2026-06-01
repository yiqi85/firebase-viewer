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
        if (typeof hourData === 'object' && hourData !== null) {
            dataByHour[hour] = hourData;
        }
    });
    
    const hourKeys = Object.keys(dataByHour);
    console.log('=== DEBUG INFO ===');
    console.log('Number of hours:', hourKeys.length);
    console.log('Hour keys:', hourKeys);
    
    if (hourKeys.length === 0) {
        chartsContainer.innerHTML = '<div class="error">No hourly data found</div>';
        return;
    }
    
    // Get all available data keys from the first hour
    const firstHour = hourKeys[0];
    const firstHourData = dataByHour[firstHour];
    console.log('First hour:', firstHour);
    console.log('First hour data:', firstHourData);
    console.log('First hour data type:', typeof firstHourData);
    
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
            console.log(`Key "${key}": value=${value}, type=${typeof value}, isNumeric=${isNumeric}`);
            return isNumeric;
        });
    }
    
    console.log('Available data keys (numeric only):', availableDataKeys);
    console.log('=== END DEBUG ===');
    
    // Create charts for all available data keys
    availableDataKeys.forEach(dataKey => {
        const chartData = extractDataForKey(dataByHour, dataKey);
        
        if (chartData && chartData.timestamps.length > 0) {
            console.log(`Creating chart for ${dataKey} with ${chartData.timestamps.length} data points`);
            createChart(chartsContainer, dataKey, chartData);
            currentData[dataKey] = chartData;
        }
    });
    
    if (Object.keys(chartsMap).length === 0) {
        chartsContainer.innerHTML = `<div class="error"><pre>No valid data points found.\n\nAvailable keys: ${availableDataKeys.join(', ') || 'none'}\n\nCheck browser console (F12) for detailed debug info.</pre></div>`;
    } else {
        console.log(`Created ${Object.keys(chartsMap).length} charts`);
    }
}
