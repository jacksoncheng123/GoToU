// Function to fetch current warnings from HKO API
async function fetchWarnings() {
    try {
        // Check if we're in test mode
        const testMode = window.location.search.includes('test=true');
        
        if (testMode) {
            // Use test data
            const response = await fetch('./test-warnings.json');
            if (!response.ok) throw new Error('Test data fetch failed');
            const data = await response.json();
            console.log('Using test data:', data);
            return data;
        } else {
            // Use real API
            const response = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en');
            if (!response.ok) throw new Error('API fetch failed');
            const data = await response.json();
            return data;
        }
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
        const hktOffset = 8 * 60 * 60 * 1000*0; // UTC+8 in ms
        return new Date(now.getTime() + hktOffset);
    }
}

// Function to check if critical warning is active
function isCriticalWarningActive(warnings) {
    if (!warnings) {
        return false;
    }
    
    // Check for Typhoon Signal 8, 9, 10 (must be ISSUE, not CANCEL)
    if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
        const code = warnings.WTCSGNL.code;
        if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
            code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
            return true;
        }
    }
    
    // Check for Black Rainstorm Warning (must be ISSUE, not CANCEL)
    if (warnings.WRAIN && warnings.WRAIN.actionCode === 'ISSUE' && warnings.WRAIN.code === 'WRAINB') {
        return true;
    }
    
    return false;
}

// Function to check decision points
function checkDecisionPoints(currentTime, warnings) {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    
    if (!warnings) return null;
    
    // Check for critical warnings and their decision times
    let earliestDecisionTime = null;
    let decisionType = null;
    
    // Check Typhoon warnings
    if (warnings.WTCSGNL) {
        const code = warnings.WTCSGNL.code;
        // Check if it's a critical typhoon signal (8, 9, 10)
        if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
            code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
            
            let decisionTime;
            if (warnings.WTCSGNL.actionCode === 'ISSUE') {
                // For ISSUE: use updateTime if it's newer than issueTime, otherwise use issueTime
                const issueTime = warnings.WTCSGNL.issueTime ? new Date(warnings.WTCSGNL.issueTime) : null;
                const updateTime = warnings.WTCSGNL.updateTime ? new Date(warnings.WTCSGNL.updateTime) : null;
                
                if (updateTime && issueTime && updateTime > issueTime) {
                    decisionTime = updateTime;
                } else if (issueTime) {
                    decisionTime = issueTime;
                }
            } else if (warnings.WTCSGNL.actionCode === 'CANCEL' && warnings.WTCSGNL.updateTime) {
                // For CANCEL: use updateTime
                decisionTime = new Date(warnings.WTCSGNL.updateTime);
            }
            
            if (decisionTime) {
                earliestDecisionTime = decisionTime;
            }
        }
    }
    
    // Check Black Rainstorm warning
    if (warnings.WRAIN && warnings.WRAIN.code === 'WRAINB') {
        let decisionTime;
        if (warnings.WRAIN.actionCode === 'ISSUE') {
            // For ISSUE: use updateTime if it's newer than issueTime, otherwise use issueTime
            const issueTime = warnings.WRAIN.issueTime ? new Date(warnings.WRAIN.issueTime) : null;
            const updateTime = warnings.WRAIN.updateTime ? new Date(warnings.WRAIN.updateTime) : null;
            
            if (updateTime && issueTime && updateTime > issueTime) {
                decisionTime = updateTime;
            } else if (issueTime) {
                decisionTime = issueTime;
            }
        } else if (warnings.WRAIN.actionCode === 'CANCEL' && warnings.WRAIN.updateTime) {
            // For CANCEL: use updateTime
            decisionTime = new Date(warnings.WRAIN.updateTime);
        }
        
        if (decisionTime) {
            if (!earliestDecisionTime || decisionTime < earliestDecisionTime) {
                earliestDecisionTime = decisionTime;
            }
        }
    }
    
    // Check decision points based on earliest warning time
    if (earliestDecisionTime) {
        const warningHours = earliestDecisionTime.getHours();
        const warningMinutes = earliestDecisionTime.getMinutes();
        
        // If warning was issued/cancelled before 7:01 AM and current time is after 7:01 AM
        if ((warningHours < 7 || (warningHours === 7 && warningMinutes < 1)) && 
            (hours > 7 || (hours === 7 && minutes >= 1))) {
            return 'morning';
        }
        
        // If warning was issued/cancelled before 12:01 PM and current time is after 12:01 PM
        if ((warningHours < 12 || (warningHours === 12 && warningMinutes < 1)) && 
            (hours > 12 || (hours === 12 && minutes >= 1))) {
            return 'afternoon';
        }
        
        // If warning was issued/cancelled before 4:01 PM and current time is after 4:01 PM
        if ((warningHours < 16 || (warningHours === 16 && warningMinutes < 1)) && 
            (hours > 16 || (hours === 16 && minutes >= 1))) {
            return 'all';
        }
    }
    
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
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });
    
    document.getElementById('current-time').innerHTML = `<strong>Current HKT:</strong> ${timeStr}`;
    
    const warnings = await fetchWarnings();
    const hasWarning = isCriticalWarningActive(warnings);
    const decision = checkDecisionPoints(currentTime, warnings);
    
    let statusEl = document.getElementById('status');
    let statusText = '';
    let statusClass = '';
    
    if (!warnings) {
        statusText = '⚠️ Unable to fetch weather warnings.<br>Please try again later.';
        statusClass = 'cancelled';
        document.getElementById('warning-info').innerHTML = '';
    } else if (!hasWarning) {
        statusText = '✅ No critical warning active.<br>You need to attend university as usual.';
        statusClass = 'safe';
        document.getElementById('warning-info').innerHTML = '';
    } else if (decision) {
        // Get warning text for status message
        let warningText = '';
        if (warnings) {
            let criticalWarnings = [];
            
            // Check for Typhoon warnings
            if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
                const code = warnings.WTCSGNL.code;
                if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                    code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                    if (code.startsWith('TC8')) {
                        criticalWarnings.push('Typhoon Signal No. 8');
                    } else {
                        criticalWarnings.push(`Typhoon Signal No. ${code.substring(2)}`);
                    }
                }
            }
            
            // Check for Black Rainstorm warning
            if (warnings.WRAIN && warnings.WRAIN.actionCode === 'ISSUE' && warnings.WRAIN.code === 'WRAINB') {
                criticalWarnings.push('Black Rainstorm Warning');
            }
            
            warningText = criticalWarnings.join(', ') || 'active warning';
        }
        
        if (decision === 'morning') {
            statusText = `❌ Morning classes (before 2 PM) cancelled due to ${warningText}.`;
        } else if (decision === 'afternoon') {
            statusText = `❌ Afternoon classes (2 PM - 6:30 PM) cancelled due to ${warningText}.`;
        } else if (decision === 'all') {
            statusText = `❌ All remaining classes cancelled due to ${warningText}.`;
        }
        statusClass = 'cancelled';
        
        // Display warning details
        let warningInfo = '';
        if (warnings) {
            let criticalWarnings = [];
            
            // Check for Typhoon warnings
            if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
                const code = warnings.WTCSGNL.code;
                if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                    code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                    if (code.startsWith('TC8')) {
                        criticalWarnings.push('Typhoon Signal No. 8');
                    } else {
                        criticalWarnings.push(`Typhoon Signal No. ${code.substring(2)}`);
                    }
                }
            }
            
            // Check for Black Rainstorm warning
            if (warnings.WRAIN && warnings.WRAIN.actionCode === 'ISSUE' && warnings.WRAIN.code === 'WRAINB') {
                criticalWarnings.push('Black Rainstorm Warning');
            }
            
            warningInfo = criticalWarnings.join(', ');
        }
        document.getElementById('warning-info').innerHTML = `<strong>Active Warnings:</strong> ${warningInfo || 'Critical warning detected'}`;
    } else {
        // Show what warning is active but decision time not reached yet
        let activeWarnings = [];
        
        // Check for active Typhoon warnings
        if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
            const code = warnings.WTCSGNL.code;
            if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                if (code.startsWith('TC8')) {
                    activeWarnings.push('Typhoon Signal No. 8');
                } else {
                    activeWarnings.push(`Typhoon Signal No. ${code.substring(2)}`);
                }
            }
        }
        
        // Check for active Black Rainstorm warning
        if (warnings.WRAIN && warnings.WRAIN.actionCode === 'ISSUE' && warnings.WRAIN.code === 'WRAINB') {
            activeWarnings.push('Black Rainstorm Warning');
        }
        
        const warningText = activeWarnings.length > 0 ? activeWarnings.join(', ') : 'Critical warning';
        statusText = `⚠️ ${warningText} <br> but decision time not reached yet. Check back later.`;
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

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
