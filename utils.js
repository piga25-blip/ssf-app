// ============================================
// UTILITAIRES
// ============================================
const getLocalStorageKey = (rescueId) => {
    const safeId = rescueId.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const vMajor = APP_VERSION ? APP_VERSION.split('.')[0] : '13';
    return `SSF_UNIFIED_STATE_${safeId}_V${vMajor}`;
};

const getContrastColor = (hexColor) => {
    const hex = hexColor.replace('#', '');
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
};

const formatDecimalHours = (decimalHours) => {
    if (isNaN(decimalHours) || decimalHours < 0) return '00:00';
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getTotalSlots = (totalDays) => totalDays * SLOTS_PER_DAY;

const indexToTime = (index, startHour, totalDays) => {
    const totalSlots = getTotalSlots(totalDays);
    const safeIndex = Math.min(index, totalSlots - 1);
    const offsetInSlots = startHour * SLOTS_PER_HOUR;
    const absoluteSlotIndex = offsetInSlots + safeIndex;
    const day = Math.floor(absoluteSlotIndex / SLOTS_PER_DAY) + 1;
    const indexSinceStartOfDay = absoluteSlotIndex % SLOTS_PER_DAY;
    const minutesSinceStartOfDay = indexSinceStartOfDay * 15;
    const hour = String(Math.floor(minutesSinceStartOfDay / 60)).padStart(2, '0');
    const minute = String(minutesSinceStartOfDay % 60).padStart(2, '0');
    return {
        day: day,
        time: `${hour}:${minute}`,
        isHourStart: (minutesSinceStartOfDay % 60) === 0,
        isDayStart: indexSinceStartOfDay === 0
    };
};
