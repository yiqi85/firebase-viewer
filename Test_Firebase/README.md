# Firebase Realtime Database Viewer

A web-based application for visualizing historical device data from Firebase Realtime Database with interactive graphs, zoom capabilities, and customizable limit visualizations.

## Features

### 📊 Interactive Graphs
- Real-time data visualization with Chart.js
- Support for up to 10 data points (data01 through data10) per device
- Interactive zoom in/out using mouse wheel
- Pan functionality (Ctrl+Click and drag)
- Responsive design that adapts to different screen sizes

### 🎯 Limit Visualization
- Set custom upper and lower limits for data
- Visual dotted lines representing limit boundaries
- Background region coloring based on three zones:
  - **Above Upper Limit**: Customizable color (default: red)
  - **Normal Range**: Customizable color (default: green)
  - **Below Lower Limit**: Customizable color (default: blue)
- Toggle limit lines and background regions on/off

### 🔧 Configuration
- Dynamic Firebase connection with JSON configuration
- Device ID selector
- Date picker for viewing historical data
- Real-time limit adjustment
- Color customization for limit regions

## Getting Started

### Prerequisites
- Firebase project with Realtime Database enabled
- Web browser with JavaScript enabled
- Firebase project credentials

### Installation

1. Navigate to the `Test_Firebase` directory
2. Open `index.html` in a web browser
3. Update Firebase configuration in the app

### Configuration Steps

#### 1. Set Up Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → Project Settings → Your apps
3. Copy the Firebase SDK config
4. In the application, paste your Firebase configuration JSON in the "Firebase Configuration (JSON)" textarea
5. Click "Connect to Firebase"

#### 2. Prepare Your Database Structure

Ensure your Firebase Realtime Database follows this structure:

```
Devices/
├── ANGSTROM_ID_1/
│   └── historical_data/
│       └── YYYY/
│           └── MM/
│               └── DD/
│                   ├── HH:MM/
│                   │   ├── data01: <value>
│                   │   ├── data02: <value>
│                   │   ├── data03: <value>
│                   │   ├── data04: <value>
│                   │   ├── data05: <value>
│                   │   ├── data06: <value>
│                   │   ├── data07: <value>
│                   │   ├── data08: <value>
│                   │   ├── data09: <value>
│                   │   └── data10: <value>
│                   ├── HH:MM/
│                   │   └── ...
│                   └── HH:MM/
│                       └── ...
└── ANGSTROM_ID_2/
    └── ...
```

**Example Data:**
```json
{
  "Devices": {
    "ANGSTROM_ID_1": {
      "historical_data": {
        "2024": {
          "05": {
            "30": {
              "08:00": {
                "data01": 45.2,
                "data02": 56.8,
                "data03": 67.3,
                "data04": 78.1,
                "data05": 89.5,
                "data06": 34.2,
                "data07": 45.6,
                "data08": 56.7,
                "data09": 67.8,
                "data10": 78.9
              },
              "09:00": {
                "data01": 46.5,
                "data02": 57.2,
                "data03": 68.1,
                "data04": 79.3,
                "data05": 90.1,
                "data06": 35.8,
                "data07": 46.2,
                "data08": 57.5,
                "data09": 68.6,
                "data10": 79.7
              }
            }
          }
        }
      }
    }
  }
}
```

### Usage

1. **Connect to Firebase**: Paste your Firebase configuration and click "Connect to Firebase"
2. **Enter Device ID**: Input the device ID (e.g., ANGSTROM_ID_1)
3. **Load Data**:
   - Click "Load Data" to view today's data
   - Or select a specific date and click "Load Date Data"
4. **Configure Limits**:
   - Set upper and lower limit values
   - Click "Apply Limits" to update the visualization
5. **Customize Colors**:
   - Select colors for above limit, normal, and below limit regions
   - Toggle "Show Limit Lines" and "Show Background Regions" to control visibility
6. **Interact with Graphs**:
   - **Zoom**: Use mouse wheel to zoom in/out
   - **Pan**: Hold Ctrl and click-drag to pan
   - **Reset**: Click "Reset Zoom" to return to original view

## Files Structure

- `index.html` - Main HTML file with UI structure
- `styles.css` - Styling and responsive design
- `app.js` - Main application logic and chart management
- `firebase-config.js` - Firebase configuration template
- `README.md` - This file

## Technologies Used

- **Firebase**: Real-time database and authentication
- **Chart.js**: Interactive charting library
- **chartjs-plugin-zoom**: Zoom and pan functionality
- **HTML5/CSS3**: Responsive web design
- **JavaScript (ES6)**: Application logic

## Features Breakdown

### Chart Controls
- **Reset Zoom**: Resets zoom level on all charts
- **Show Limit Lines**: Toggles visibility of upper and lower limit lines
- **Show Background Regions**: Toggles visibility of colored background regions

### Limit Visualization
- Upper and lower limits are displayed as dotted lines
- Background is divided into three regions with customizable colors:
  - Red zone: Values above upper limit
  - Green zone: Values between limits (normal)
  - Blue zone: Values below lower limit

### Data Handling
- Supports multiple time entries per day
- Automatically sorts data chronologically
- Handles missing data points gracefully
- Supports up to 10 concurrent data streams (data01-data10)

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Opera: Full support

## Troubleshooting

### Connection Issues
- Verify Firebase configuration is correct
- Check Firebase Realtime Database rules allow read access
- Ensure database URL includes `https://`

### No Data Displayed
- Confirm device ID matches exactly
- Verify data exists in the database at the specified path
- Check date format and ensure data exists for selected date
- Review Firebase Realtime Database rules

### Performance Issues
- For large datasets, consider filtering by time range
- Close unused browser tabs
- Clear browser cache if experiencing lag

## Future Enhancements

- [ ] Export data to CSV
- [ ] Data filtering and search
- [ ] Multiple device comparison
- [ ] Real-time data streaming
- [ ] Data aggregation options
- [ ] Custom time range selection
- [ ] Dark mode theme
- [ ] Data analytics dashboard

## License

MIT License - Feel free to use and modify as needed.

## Support

For issues or questions, please open an issue in the repository.
