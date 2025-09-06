// Global variables
let universitiesData = null;
let selectedUniversity = null;

// Function to fetch universities data
async function fetchUniversities() {
    try {
        const response = await fetch('./universities.json');
        if (!response.ok) throw new Error('Universities data fetch failed');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching universities:', error);
        return null;
    }
}

// Function to populate university selector
async function populateUniversitySelector() {
    universitiesData = await fetchUniversities();
    const selector = document.getElementById('university-select');
    
    if (!universitiesData) {
        selector.innerHTML = '<option value="">Error loading universities</option>';
        return;
    }
    
    // Clear loading message
    selector.innerHTML = '';
    
    // Add default option
    selector.innerHTML = '<option value="">Choose your university...</option>';
    
    // Add universities
    universitiesData.universities.forEach(uni => {
        const option = document.createElement('option');
        option.value = uni.id;
        option.textContent = uni.name;
        selector.appendChild(option);
    });
    
    // Load saved selection
    const saved = localStorage.getItem('selectedUniversity');
    if (saved) {
        selector.value = saved;
        updateSelectedUniversity(saved);
    }
    
    // Add event listener
    selector.addEventListener('change', function() {
        const selectedId = this.value;
        if (selectedId) {
            localStorage.setItem('selectedUniversity', selectedId);
            updateSelectedUniversity(selectedId);
        } else {
            localStorage.removeItem('selectedUniversity');
            selectedUniversity = null;
            document.getElementById('decision-times').innerHTML = '';
        }
        updateStatus();
    });
}

// Function to update selected university and display decision times
function updateSelectedUniversity(universityId) {
    selectedUniversity = universitiesData.universities.find(uni => uni.id === universityId);
    
    if (selectedUniversity) {
        const times = selectedUniversity.decisionTimes;
        const classes = selectedUniversity.classTimes;
        document.getElementById('decision-times').innerHTML = 
            `<strong>${selectedUniversity.name}</strong><br>` +
            `<strong>Decision Times:</strong> ${times.morning} AM → No morning classes | ` +
            `${times.afternoon} PM → No afternoon classes | ` +
            `${times.all} PM → All classes cancelled<br>` +
            `<strong>Class Times:</strong> Morning: ${classes.morning} | ` +
            `Afternoon: ${classes.afternoon} | Evening: ${classes.evening}`;
    }
}

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
    
    if (!warnings || !selectedUniversity) return null;
    
    // Get decision times for selected university
    const decisionTimes = selectedUniversity.decisionTimes;
    const morningTime = decisionTimes.morning.split(':');
    const afternoonTime = decisionTimes.afternoon.split(':');
    const allTime = decisionTimes.all.split(':');
    
    const morningHour = parseInt(morningTime[0]);
    const morningMin = parseInt(morningTime[1]);
    const afternoonHour = parseInt(afternoonTime[0]);
    const afternoonMin = parseInt(afternoonTime[1]);
    const allHour = parseInt(allTime[0]);
    const allMin = parseInt(allTime[1]);
    
    // Check if there are any active critical warnings (ISSUE status)
    let hasActiveCriticalWarning = false;
    
    // Check for active Typhoon warnings
    if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
        const code = warnings.WTCSGNL.code;
        if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
            code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
            hasActiveCriticalWarning = true;
        }
    }
    
    // Check for active Black Rainstorm warning
    if (warnings.WRAIN && warnings.WRAIN.actionCode === 'ISSUE' && warnings.WRAIN.code === 'WRAINB') {
        hasActiveCriticalWarning = true;
    }
    
    // If there are active critical warnings, use current time for decision points
    if (hasActiveCriticalWarning) {
        // Check current time against decision points
        if (hours > allHour || (hours === allHour && minutes >= allMin)) {
            // After all classes decision time
            return 'all';
        } else if (hours > afternoonHour || (hours === afternoonHour && minutes >= afternoonMin)) {
            // After afternoon decision time
            return 'afternoon';
        } else if (hours > morningHour || (hours === morningHour && minutes >= morningMin)) {
            // After morning decision time
            return 'morning';
        }
    }
    
    // If no active warnings, check for cancelled warnings and their decision times
    let earliestDecisionTime = null;
    
    // Check cancelled Typhoon warnings
    if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'CANCEL') {
        const code = warnings.WTCSGNL.code;
        if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
            code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
            
            if (warnings.WTCSGNL.updateTime) {
                const decisionTime = new Date(warnings.WTCSGNL.updateTime);
                earliestDecisionTime = decisionTime;
            }
        }
    }
    
    // Check cancelled Black Rainstorm warning
    if (warnings.WRAIN && warnings.WRAIN.actionCode === 'CANCEL' && warnings.WRAIN.code === 'WRAINB') {
        if (warnings.WRAIN.updateTime) {
            const decisionTime = new Date(warnings.WRAIN.updateTime);
            if (!earliestDecisionTime || decisionTime < earliestDecisionTime) {
                earliestDecisionTime = decisionTime;
            }
        }
    }
    
    // Check decision points based on earliest cancelled warning time
    if (earliestDecisionTime) {
        const warningHours = earliestDecisionTime.getHours();
        const warningMinutes = earliestDecisionTime.getMinutes();
        
        // Check against university-specific decision times
        if ((warningHours < morningHour || (warningHours === morningHour && warningMinutes < morningMin)) && 
            (hours > morningHour || (hours === morningHour && minutes >= morningMin))) {
            return 'morning';
        }
        
        if ((warningHours < afternoonHour || (warningHours === afternoonHour && warningMinutes < afternoonMin)) && 
            (hours > afternoonHour || (hours === afternoonHour && minutes >= afternoonMin))) {
            return 'afternoon';
        }
        
        if ((warningHours < allHour || (warningHours === allHour && warningMinutes < allMin)) && 
            (hours > allHour || (hours === allHour && minutes >= allMin))) {
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
    
    document.getElementById('current-time').innerHTML = `<strong>Updated at HKT:</strong> ${timeStr}`;
    
    let statusEl = document.getElementById('status');
    let statusText = '';
    let statusClass = '';
    
    // Check if university is selected
    if (!selectedUniversity) {
        statusText = '📚 Please select your university first to check class status.';
        statusClass = 'safe';
        document.getElementById('warning-info').innerHTML = '';
        statusEl.innerHTML = statusText;
        statusEl.className = statusClass;
        return;
    }
    
    const warnings = await fetchWarnings();
    const hasWarning = isCriticalWarningActive(warnings);
    const decision = checkDecisionPoints(currentTime, warnings);
    
    if (!warnings) {
        statusText = '⚠️ Unable to fetch weather warnings.<br>Please try again later.';
        statusClass = 'cancelled';
        document.getElementById('warning-info').innerHTML = '';
    } else if (!hasWarning) {
        // Check if there are cancelled warnings to display
        let cancelledWarnings = [];
        
        if (warnings) {
            // Check for cancelled Typhoon warnings
            if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'CANCEL') {
                const code = warnings.WTCSGNL.code;
                if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                    code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                    
                    let warningName;
                    if (code.startsWith('TC8')) {
                        warningName = 'Typhoon Signal No. 8';
                    } else {
                        warningName = `Typhoon Signal No. ${code.substring(2)}`;
                    }
                    
                    const cancelTime = new Date(warnings.WTCSGNL.updateTime);
                    const cancelTimeStr = cancelTime.toLocaleString('en-HK', { 
                        timeZone: 'Asia/Hong_Kong',
                        hour12: true,
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    cancelledWarnings.push(`${warningName} (cancelled at ${cancelTimeStr})`);
                }
            }
            
            // Check for cancelled Black Rainstorm warning
            if (warnings.WRAIN && warnings.WRAIN.actionCode === 'CANCEL' && warnings.WRAIN.code === 'WRAINB') {
                const cancelTime = new Date(warnings.WRAIN.updateTime);
                const cancelTimeStr = cancelTime.toLocaleString('en-HK', { 
                    timeZone: 'Asia/Hong_Kong',
                    hour12: true,
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
                cancelledWarnings.push(`Black Rainstorm Warning (cancelled at ${cancelTimeStr})`);
            }
        }
        
        if (cancelledWarnings.length > 0) {
            statusText = '✅ No critical warning active.<br>You need to attend university as usual.';
            statusClass = 'safe';
            document.getElementById('warning-info').innerHTML = `<strong>Recently Cancelled:</strong> ${cancelledWarnings.join(', ')}`;
        } else {
            statusText = '✅ No critical warning active.<br>You need to attend university as usual.';
            statusClass = 'safe';
            document.getElementById('warning-info').innerHTML = '';
        }
    } else if (decision) {
        // Get warning text for status message
        let warningText = '';
        let isWarningCancelled = false;
        
        if (warnings) {
            let criticalWarnings = [];
            
            // Check for Typhoon warnings
            if (warnings.WTCSGNL) {
                const code = warnings.WTCSGNL.code;
                if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                    code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                    
                    let warningName;
                    if (code.startsWith('TC8')) {
                        warningName = 'Typhoon Signal No. 8';
                    } else {
                        warningName = `Typhoon Signal No. ${code.substring(2)}`;
                    }
                    
                    if (warnings.WTCSGNL.actionCode === 'ISSUE') {
                        criticalWarnings.push(warningName);
                    } else if (warnings.WTCSGNL.actionCode === 'CANCEL') {
                        criticalWarnings.push(`${warningName} (cancelled)`);
                        isWarningCancelled = true;
                    }
                }
            }
            
            // Check for Black Rainstorm warning
            if (warnings.WRAIN && warnings.WRAIN.code === 'WRAINB') {
                if (warnings.WRAIN.actionCode === 'ISSUE') {
                    criticalWarnings.push('Black Rainstorm Warning');
                } else if (warnings.WRAIN.actionCode === 'CANCEL') {
                    criticalWarnings.push('Black Rainstorm Warning (cancelled)');
                    isWarningCancelled = true;
                }
            }
            
            warningText = criticalWarnings.join(', ') || 'warning';
        }
        
        if (decision === 'morning') {
            const morningTime = selectedUniversity.classTimes.morning;
            statusText = `❌ Morning classes (${morningTime}) cancelled due to ${warningText}.`;
        } else if (decision === 'afternoon') {
            const afternoonTime = selectedUniversity.classTimes.afternoon;
            statusText = `❌ Afternoon classes (${afternoonTime}) cancelled due to ${warningText}.`;
        } else if (decision === 'all') {
            statusText = `❌ All remaining classes cancelled due to ${warningText}.`;
        }
        statusClass = 'cancelled';
        
        // Display warning details
        let warningInfo = '';
        if (warnings) {
            let criticalWarnings = [];
            
            // Check for Typhoon warnings
            if (warnings.WTCSGNL) {
                const code = warnings.WTCSGNL.code;
                if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                    code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                    
                    let warningName;
                    if (code.startsWith('TC8')) {
                        warningName = 'Typhoon Signal No. 8';
                    } else {
                        warningName = `Typhoon Signal No. ${code.substring(2)}`;
                    }
                    
                    if (warnings.WTCSGNL.actionCode === 'ISSUE') {
                        criticalWarnings.push(`${warningName} (Active)`);
                    } else if (warnings.WTCSGNL.actionCode === 'CANCEL') {
                        const cancelTime = new Date(warnings.WTCSGNL.updateTime);
                        const cancelTimeStr = cancelTime.toLocaleString('en-HK', { 
                            timeZone: 'Asia/Hong_Kong',
                            hour12: true,
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        });
                        criticalWarnings.push(`${warningName} (Cancelled at ${cancelTimeStr})`);
                    }
                }
            }
            
            // Check for Black Rainstorm warning
            if (warnings.WRAIN && warnings.WRAIN.code === 'WRAINB') {
                if (warnings.WRAIN.actionCode === 'ISSUE') {
                    criticalWarnings.push('Black Rainstorm Warning (Active)');
                } else if (warnings.WRAIN.actionCode === 'CANCEL') {
                    const cancelTime = new Date(warnings.WRAIN.updateTime);
                    const cancelTimeStr = cancelTime.toLocaleString('en-HK', { 
                        timeZone: 'Asia/Hong_Kong',
                        hour12: true,
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    });
                    criticalWarnings.push(`Black Rainstorm Warning (Cancelled at ${cancelTimeStr})`);
                }
            }
            
            warningInfo = criticalWarnings.join(', ');
        }
        document.getElementById('warning-info').innerHTML = `<strong>Warnings:</strong> ${warningInfo || 'Critical warning detected'}`;
    } else {
        // Show what warning is active but decision time not reached yet
        let activeWarnings = [];
        
        // Check for Typhoon warnings (only ISSUE, not CANCEL)
        if (warnings.WTCSGNL && warnings.WTCSGNL.actionCode === 'ISSUE') {
            const code = warnings.WTCSGNL.code;
            if (code === 'TC8' || code === 'TC8NE' || code === 'TC8SE' || 
                code === 'TC8SW' || code === 'TC8NW' || code === 'TC9' || code === 'TC10') {
                
                let warningName;
                if (code.startsWith('TC8')) {
                    warningName = 'Typhoon Signal No. 8';
                } else {
                    warningName = `Typhoon Signal No. ${code.substring(2)}`;
                }
                
                activeWarnings.push(warningName);
            }
        }
        
        // Check for Black Rainstorm warning (only ISSUE, not CANCEL)
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
async function initialize() {
    await populateUniversitySelector();
    updateStatus();
}

initialize();

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
