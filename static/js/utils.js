// Set a cookie with a specified name, value, and expiration days
export function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Set expiration date
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/"; // Set cookie with expiration
}

// Retrieve a cookie value by name
export function getCookie(name) {
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let cookie of cookieArray) {
        let trimmedCookie = cookie.trim();
        if (trimmedCookie.indexOf(name + "=") === 0) {
            return trimmedCookie.substring(name.length + 1, trimmedCookie.length);
        }
    }
    return "";
}

// Helper function to find the price for a specific date in a price chart
export function findPriceForDate(date, priceChart) {
    const index = priceChart.dates.indexOf(date);
    return index !== -1 ? priceChart.prices[index] : null;
}
// Format a JavaScript Date object to 'YYYY-MM-DD' string
export function formatDateToYYYYMMDD(date) {
    let year = date.getFullYear();
    let month = ('0' + (date.getMonth() + 1)).slice(-2); // Add leading zero for single digit months
    let day = ('0' + date.getDate()).slice(-2); // Add leading zero for single digit days
    return `${year}-${month}-${day}`;
}
// Helper function to format large numbers into billions (B), millions (M), or thousands (K)
export function formatLargeNumbers(value) {
    if (Math.abs(value) >= 1e9) {
        return (value / 1e9).toFixed(2) + 'B';  // Format to billions
    } else if (Math.abs(value) >= 1e6) {
        return (value / 1e6).toFixed(2) + 'M';  // Format to millions
    } else if (Math.abs(value) >= 1e3) {
        return (value / 1e3).toFixed(2) + 'K';  // Format to thousands
    } else {
        return value.toFixed(2);  // For smaller values, just show the value as-is
    }
}

// Helper function to format percentages
export function formatPercentage(value) {
    return `${value.toFixed(2)}%`;  // Format to 2 decimal places with a percentage symbol
}

// Helper function to capitalize the first letter of a string
export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

// Helper function to round values to two decimal places
export function roundToTwoDecimals(value) {
    return parseFloat(value.toFixed(2));
}
export function setActiveButton(buttonId) {
    const buttons = document.querySelectorAll('#timeRangeButtons .btn');
    buttons.forEach(button => {
        if (button.id === buttonId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Function to get the active button in the button group
export function getActiveButton() {
    const activeButton = document.querySelector('#timeRangeButtons .btn.active');
    return activeButton ? activeButton.id : null;
}

// Helper function to format values in billions of dollars
export function formatValue(value) {
    // Helper function to format large numbers like billions and millions
    if (typeof value === 'number') {
        if (Math.abs(value) >= 1e9) {
            return `$${(value / 1e9).toFixed(2)}B`;  // Convert to billions
        } else if (Math.abs(value) >= 1e6) {
            return `$${(value / 1e6).toFixed(2)}M`;  // Convert to millions
        } else {
            return `$${value.toFixed(2)}`;
        }
    }
    return value;  // Return non-number values as is
}

// Helper function to format values in billions of dollars
export function formatToBillions(value) {
    return (value / 1e9).toFixed(2); // Convert to billions and format to 2 decimal places
}