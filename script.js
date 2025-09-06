// Function to fetch current warnings from HKO API
async function fetchWarnings() {
    try {
        const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en');
        if (!response.ok) throw new Error('API fetch failed');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching warnings:', error);
        return null;
    }
}

// Function to fetch current HKT from worldtimeapi.org
async function getCurrentHKT() {
    try {
        const response = await fetch('http://worldtimeapi.org/api/timezone/Asia/Hong_Kong');
        if (!response.ok) throw new Error('Time API fetch failed');
        const data = await response.json();
        return new Date(data.datetime); // Returns HKT as a Date object
    } catch (error) {
        console.error('Error fetching HKT:', error);
        // Fallback: Assume current time (less reliable, but prevents failure)
        const now = new Date();
        const hktOffset = 8 * 60 * 60 * 1000; // UTC+8 in ms
        return new Date(now.getTime() + hktOffset);
    }
}

// Function to check if critical warning is active
function isCriticalWarningActive(warnings) {
    if (!warnings || !warnings.warningInfo || !warnings.warningInfo.warningList) {
        return false;
    }
    const list = warnings.warningInfo.warningList;
    return list.some(warning => {
        const code = warning.warningCode;
        // Typhoon 8,9,10: Codes like 'TC8', 'TC9', 'TC10'
        // Black Rainstorm: 'RWS'
        return code === 'TC8' || code === 'TC9' || code === 'TC10' || code === 'RWS';
    });
}

// Function to check decision points
function checkDecisionPoints(currentTime) {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    
    // 7:01 AM
    if (hours === 7 && minutes >= 1) return 'morning'; // Before 2 PM cancelled
    
    // 12:01 PM
    if (hours === 12 && minutes >= 1) return 'afternoon'; // 2 PM - 6:30 PM cancelled
    
    // 4:01 PM
    if (hours === 16 && minutes >= 1) return 'all'; // All cancelled
    
    return null; // No decision point reached yet
}

// Main function to update status
async function updateStatus() {
    const currentTime = await getCurrentHKT();
    // Format time explicitly for HKT
    const timeStr = currentTime.toLocaleString('en-HK', { 
        timeZone: 'Asia/Hong_Kong',
        hour12: true,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    document.getElementById('current-time').innerHTML = `<strong>Current HKT:</strong> ${timeStr}`;
    
    const warnings = await fetchWarnings();
    const hasWarning = isCriticalWarningActive(warnings);
    const decision = checkDecisionPoints(currentTime);
    
    let statusEl = document.getElementById('status');
    let statusText = '';
    let statusClass = '';
    
    if (!warnings) {
        statusText = '⚠️ Unable to fetch weather warnings. Please try again later.';
        statusClass = 'cancelled';
        document.getElementById('warning-info').innerHTML = '';
    } else if (!hasWarning) {
        statusText = '✅ No critical warning active. You may need to attend university as usual.';
        statusClass = 'safe';
        document.getElementById('warning-info').innerHTML = '';
    } else if (decision) {
        if (decision === 'morning') {
            statusText = '❌ Morning classes (before 2 PM) cancelled due to active warning.';
        } else if (decision === 'afternoon') {
            statusText = '❌ Afternoon classes (2 PM - 6:30 PM) cancelled due to active warning.';
        } else if (decision === 'all') {
            statusText = '❌ All remaining classes cancelled due to active warning.';
        }
        statusClass = 'cancelled';
        
        // Display warning details
        let warningInfo = '';
        if (warnings && warnings.warningInfo && warnings.warningInfo.warningList) {
            const criticalWarnings = warnings.warningInfo.warningList.filter(w => 
                w.warningCode === 'TC8' || w.warningCode === 'TC9' || w.warningCode === 'TC10' || w.warningCode === 'RWS'
            );
            warningInfo = criticalWarnings.map(w => `${w.warningNameEn} (${w.warningCode})`).join(', ');
        }
        document.getElementById('warning-info').innerHTML = `<strong>Active Warnings:</strong> ${warningInfo || 'Critical warning detected'}`;
    } else {
        statusText = '⚠️ Critical warning active, but decision time not reached yet. Check back later.';
        statusClass = 'cancelled';
        document.getElementById('warning-info').innerHTML = '';
    }
    
    statusEl.innerHTML = statusText;
    statusEl.className = statusClass;
}

// Manual check button
function checkStatus() {
    updateStatus();
}

// Auto-refresh every 5 minutes (300000 ms)
setInterval(updateStatus, 300000);

// Initial load
updateStatus();
