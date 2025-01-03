// File handling
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dashboard = document.getElementById('dashboard');
let transactions = []; // Define transactions at the top level

// Event listeners for file drag & drop
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#0066cc';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ccc';
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
        processCSV(file);
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processCSV(file);
    }
});

function processCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        transactions = parseCSV(text);
        
        if (transactions && transactions.length > 0) {
            initializePeriodSelectors(transactions);
            const recurring = detectRecurringPayments(transactions);
            if (recurring && recurring.length > 0) {
                showRecurringModal(recurring);
            } else {
                // Only update dashboard if no recurring payments to categorize
                updateDashboard(transactions);
                dashboard.classList.remove('hidden');
            }
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const transactions = [];
    let pendingConversion = null;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            .map(val => val.replace(/"/g, ''));

        const transaction = {
            date: values[0],
            time: values[1],
            timeZone: values[2],
            name: values[3],
            type: values[4],
            status: values[5],
            currency: values[6],
            amount: parseFloat(values[7]) || 0,
            receiptId: values[8],
            balance: parseFloat(values[9]) || 0,
            category: detectCategory(values[3], values[4])
        };

        // Handle currency conversions
        if (transaction.type === 'General Currency Conversion') {
            if (!pendingConversion) {
                pendingConversion = transaction;
            } else {
                // Match the conversion with its pair
                if (pendingConversion.amount < 0) {
                    // Previous transaction was source, current is destination
                    pendingConversion.convertedAmount = transaction.amount;
                } else {
                    // Previous transaction was destination, current is source
                    pendingConversion.convertedAmount = pendingConversion.amount;
                    pendingConversion.amount = Math.abs(transaction.amount);
                }
                transactions.push(pendingConversion);
                pendingConversion = null;
            }
            continue;
        }

        // Only include completed transactions
        if (transaction.status === 'Completed') {
            // If transaction is not in USD, look for corresponding conversion
            if (transaction.currency !== 'USD') {
                const conversionLine = findConversion(lines, i, transaction.amount);
                if (conversionLine) {
                    const conversionValues = conversionLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
                        .map(val => val.replace(/"/g, ''));
                    transaction.originalAmount = transaction.amount;
                    transaction.originalCurrency = transaction.currency;
                    transaction.amount = parseFloat(conversionValues[7]);
                    transaction.currency = 'USD';
                }
            }
            transactions.push(transaction);
        }
    }

    return transactions;
}

function findConversion(lines, currentIndex, amount) {
    // Look for currency conversion within 3 lines
    for (let i = Math.max(0, currentIndex - 3); i < Math.min(lines.length, currentIndex + 3); i++) {
        if (lines[i].includes('General Currency Conversion') && lines[i].includes('USD')) {
            return lines[i];
        }
    }
    return null;
}

function detectCategory(name, type) {
    // Updated category detection based on PayPal transaction types
    const categories = {
        'subscription': [
            'Subscription Payment',
            'PreApproved Payment Bill User Payment',
            'Netflix',
            'Spotify',
            'Discord',
            'Patreon'
        ],
        'services': [
            'General Payment',
            'Express Checkout Payment',
            'Website Payment'
        ],
        'transfer': [
            'General Card Withdrawal',
            'General Card Deposit',
            'Bank Deposit',
            'Money Transfer'
        ],
        'refund': [
            'Payment Refund'
        ]
    };

    const description = `${name} ${type}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => description.toLowerCase().includes(keyword.toLowerCase()))) {
            return category;
        }
    }
    
    return 'other';
}

function normalizeVendorName(name) {
    // Map of known name variations to canonical names (with proper capitalization)
    const nameMap = {
        'patreon': 'Patreon',
        'patreon inc': 'Patreon',
        'microsoft': 'Microsoft',
        'microsoft corporation': 'Microsoft',
        'discord': 'Discord',
        'discord inc': 'Discord',
        'uber technologies': 'Uber',
        'uber': 'Uber',
        'spotify': 'Spotify',
        'spotify usa': 'Spotify',
        'google': 'Google',
        'google inc': 'Google',
        'canva': 'Canva',
        'canva pty limited': 'Canva',
        'canva us': 'Canva',
        'fur affinity': 'Fur Affinity',
        'fur affinity | frost dragon art llc': 'Fur Affinity',
        'frost dragon': 'Fur Affinity',
        'frost dragon inc': 'Fur Affinity',
        'twitch': 'Twitch',
        'twitch interactive': 'Twitch',
        'twitch interactive, inc': 'Twitch'
    };

    // Clean up the name but keep original capitalization if no mapping exists
    let normalized = name
        .replace(/(, inc\.?$)|(inc\.?$)|(,? llc$)|(ltd\.?$)|(\.[a-z]+$)|(pty limited$)|(us$)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Check for name mapping using lowercase comparison
    const mappedName = nameMap[normalized.toLowerCase()];
    return mappedName || normalized;
}

function detectRecurringPayments(transactions) {
    const vendors = {};
    
    // Group by normalized vendor name and calculate frequency
    transactions.forEach(t => {
        if (t.amount < 0 && t.name) {
            const normalizedName = normalizeVendorName(t.name);
            if (!vendors[normalizedName]) {
                vendors[normalizedName] = {
                    name: normalizedName, // Use normalized name
                    totalSpent: 0,
                    transactions: [],
                    isBusinessVendor: isBusinessVendor(normalizedName),
                    category: t.category
                };
            }
            vendors[normalizedName].totalSpent += Math.abs(t.amount);
            vendors[normalizedName].transactions.push(t);
        }
    });

    // Convert to array and filter significant vendors
    const recurring = Object.values(vendors)
        .filter(v => v.transactions.length >= 2) // At least 2 transactions
        .filter(v => v.isBusinessVendor || (v.totalSpent / v.transactions.length) >= 500)
        .map(v => ({
            vendor: v.name,
            frequency: detectFrequency(v.transactions),
            category: v.category,
            avgAmount: v.totalSpent / v.transactions.length,
            isBusinessVendor: v.isBusinessVendor
        }))
        .sort((a, b) => b.avgAmount - a.avgAmount); // Sort by average amount

    return recurring;
}

function isBusinessVendor(name) {
    // Comprehensive list of business service providers and platforms
    const businessKeywords = [
        // Software & Cloud Services
        'adobe', 'aws', 'dropbox', 'google', 'microsoft', 'slack', 'zoom',
        'salesforce', 'squarespace', 'godaddy', 'bluehost', 'mailchimp',
        'hootsuite', 'wordpress', 'twitch',
        
        // Creative & Design
        'canva', 'shutterstock', '99designs', 'envato', 'zazzle', 'redbubble',
        'printful', 'vistaprint',
        
        // E-commerce & Payment
        'shopify', 'bigcommerce', 'woocommerce', 'magento', 'stripe', 'square',
        'paypal', 'freshbooks', 'quickbooks', 'xero',
        
        // Subscription Services
        'netflix', 'spotify', 'discord', 'patreon',
        
        // Freelance & Learning Platforms
        'fiverr', 'upwork', 'freelancer', 'toptal', 'gumroad',
        'udemy', 'coursera', 'skillshare', 'teachable',
        
        // General Business Terms
        'hosting', 'cloud', 'software', 'service', 'business', 'professional',
        'subscription', 'recurring',

        // Gaming & Entertainment 
        'steam', 'valve', 'epic games', 'nintendo', 'sony', 'playstation',
        'xbox', 'microsoft gaming', 'bethesda', 'activision', 'blizzard',
        'ea', 'electronic arts', 'ubisoft', 'bandai namco', 'square enix',
        'rockstar', 'riot games', 'game pass', 'xbox live', 'psn',
        'playstation network', 'battle.net', 'origin', 'uplay'
    ];
    
    const loweredName = name.toLowerCase();
    return businessKeywords.some(keyword => loweredName.includes(keyword));
}

function detectFrequency(transactions) {
    // Simple frequency detection based on average days between payments
    if (transactions.length < 2) return 'One-time';
    
    const dates = transactions.map(t => new Date(t.date));
    const avgDays = (dates[dates.length-1] - dates[0]) / (dates.length - 1) / (1000 * 60 * 60 * 24);
    
    if (avgDays <= 32) return 'Monthly';
    if (avgDays <= 95) return 'Quarterly';
    return 'Yearly';
}

function showRecurringModal(recurring) {
    const modal = document.getElementById('recurringModal');
    const tbody = document.querySelector('#recurringTable tbody');
    tbody.innerHTML = '';

    recurring.forEach(r => {
        const row = tbody.insertRow();
        if (r.isBusinessVendor) row.classList.add('high-value');
        
        row.innerHTML = `
            <td>${r.vendor}</td>
            <td>${r.frequency}</td>
            <td>
                <select>
                    <option value="business" ${r.isBusinessVendor ? 'selected' : ''}>Business</option>
                    <option value="personal" ${!r.isBusinessVendor ? 'selected' : ''}>Personal</option>
                </select>
            </td>
        `;
    });

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    setupModalHandlers(recurring);
}

function setupModalHandlers(recurring) {
    const modal = document.getElementById('recurringModal');
    
    document.getElementById('markAllBtn').onclick = () => {
        document.querySelectorAll('#recurringTable select')
            .forEach(select => select.value = 'business');
    };
    
    document.getElementById('ignoreAllBtn').onclick = () => {
        document.querySelectorAll('#recurringTable select')
            .forEach(select => select.value = 'personal');
    };
    
    document.getElementById('confirmBtn').onclick = () => {
        const selections = Array.from(document.querySelectorAll('#recurringTable tbody tr')).map((row, i) => ({
            vendor: recurring[i].vendor,
            category: row.querySelector('select').value
        }));
        
        updateTransactionCategories(selections);
        updateDashboard(transactions); // Update dashboard after categorization
        dashboard.classList.remove('hidden');
        modal.classList.add('hidden');
    };
    
    document.getElementById('dismissBtn').onclick = () => {
        updateDashboard(transactions); // Update dashboard if user dismisses modal
        dashboard.classList.remove('hidden');
        modal.classList.add('hidden');
    };
}

function updateTransactionCategories(selections) {
    selections.forEach(selection => {
        transactions.forEach(transaction => {
            if (normalizeVendorName(transaction.name) === selection.vendor) {
                transaction.category = selection.category;
            }
        });
    });
    updateSummaryCards(transactions);
}

function updateDashboard(transactions) {
    // Clear all existing charts first
    clearCharts();
    // Then update everything with filtered data
    updateSummaryCards(transactions);
    analyzeTransactions(transactions);
    updateCharts(transactions);
}

function clearCharts() {
    const chartIds = [
        'incomeExpensesChart',
        'topCustomersChart',
        'transactionTypeChart',
        'monthlyRevenueChart',
        'cashFlowChart',
        'cumulativeBalanceChart',
        'customerGrowthChart',
        'transactionDistributionChart',
        'dailyPatternChart',
        'categoryDistributionChart',
        'paymentMethodsChart',
        'seasonalRevenueChart'
    ];

    chartIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const chart = Chart.getChart(canvas);
            if (chart) {
                chart.destroy();
            }
        }
    });
}

function updateCharts(transactions) {
    createIncomeExpensesChart(transactions);
    createTopCustomersChart(transactions);
    createTransactionTypeChart(transactions);
    createMonthlyRevenueChart(transactions);
    createCashFlowChart(transactions);
    createCumulativeBalanceChart(transactions);
    createCustomerGrowthChart(transactions);
    createTransactionDistributionChart(transactions);
    createDailyPatternChart(transactions);
    createCategoryDistributionChart(transactions);
    createPaymentMethodsChart(transactions);
    createSeasonalRevenueChart(transactions);
}

function createIncomeExpensesChart(transactions) {
    const monthlyData = transactions.reduce((acc, t) => {
        const date = new Date(t.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[monthYear]) {
            acc[monthYear] = { income: 0, expenses: 0 };
        }
        
        if (t.amount > 0 && t.category !== 'transfer') {
            acc[monthYear].income += t.amount;
        } else if (t.amount < 0 && t.category !== 'transfer') {
            acc[monthYear].expenses += Math.abs(t.amount);
        }
        
        return acc;
    }, {});

    const labels = Object.keys(monthlyData).sort();
    const incomeData = labels.map(month => monthlyData[month].income);
    const expenseData = labels.map(month => monthlyData[month].expenses);

    const ctx = document.getElementById('incomeExpensesChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(month => {
                const [year, monthNum] = month.split('-');
                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'Income',
                data: incomeData,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                fill: true
            }, {
                label: 'Expenses',
                data: expenseData,
                borderColor: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createTopCustomersChart(transactions) {
    const customerData = getTopCustomers(transactions);
    
    const ctx = document.getElementById('topCustomersChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: customerData.map(([name]) => name),
            datasets: [{
                label: 'Revenue',
                data: customerData.map(([_, amount]) => amount),
                backgroundColor: '#2196F3'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createTransactionTypeChart(transactions) {
    // Define category mapping for transaction types
    const typeCategories = {
        'General Payment': 'Payments',
        'Website Payment': 'Payments',
        'Express Checkout Payment': 'Payments',
        'Mobile Payment': 'Payments',
        'eBay Auction Payment': 'Marketplace',
        'PreApproved Payment Bill User Payment': 'Subscriptions',
        'Subscription Payment': 'Subscriptions',
        'General Card Withdrawal': 'Bank Transfers',
        'General Card Deposit': 'Bank Transfers',
        'Bank Deposit to PP Account': 'Bank Transfers',
        'General Withdrawal': 'Bank Transfers',
        'Payment Refund': 'Refunds',
        'General Currency Conversion': 'Currency Exchange',
        'Tax collected by partner': 'Tax Related'
    };

    // Group transactions by normalized categories
    const categoryData = transactions.reduce((acc, t) => {
        if (t.type) {
            const category = typeCategories[t.type] || 'Other';
            acc[category] = (acc[category] || 0) + 1;
        }
        return acc;
    }, {});

    const ctx = document.getElementById('transactionTypeChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#4CAF50', // Payments
                    '#2196F3', // Marketplace
                    '#FFC107', // Subscriptions
                    '#9C27B0', // Bank Transfers
                    '#F44336', // Refunds
                    '#009688', // Currency Exchange
                    '#FF5722', // Tax Related
                    '#607D8B'  // Other
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function createMonthlyRevenueChart(transactions) {
    const monthlyRevenue = transactions
        .filter(t => t.amount > 0 && t.category !== 'transfer')
        .reduce((acc, t) => {
            const date = new Date(t.date);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            acc[monthYear] = (acc[monthYear] || 0) + t.amount;
            return acc;
        }, {});

    const labels = Object.keys(monthlyRevenue).sort();
    const data = labels.map(month => monthlyRevenue[month]);

    const ctx = document.getElementById('monthlyRevenueChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(month => {
                const [year, monthNum] = month.split('-');
                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'Monthly Revenue',
                data: data,
                backgroundColor: '#673AB7'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createCashFlowChart(transactions) {
    const monthlyData = transactions.reduce((acc, t) => {
        const date = new Date(t.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[monthYear]) {
            acc[monthYear] = 0;
        }
        
        if (t.category !== 'transfer') {
            acc[monthYear] += t.amount;
        }
        
        return acc;
    }, {});

    const labels = Object.keys(monthlyData).sort();
    const data = labels.map(month => monthlyData[month]);

    const ctx = document.getElementById('cashFlowChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(month => {
                const [year, monthNum] = month.split('-');
                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'Net Cash Flow',
                data: data,
                backgroundColor: data.map(value => value >= 0 ? '#4CAF50' : '#f44336')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createCumulativeBalanceChart(transactions) {
    const sortedTransactions = [...transactions]
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let balance = 0;
    const balanceData = sortedTransactions.reduce((acc, t) => {
        if (t.category !== 'transfer') {
            balance += t.amount;
            acc.push({
                date: t.date,
                balance: balance
            });
        }
        return acc;
    }, []);

    const ctx = document.getElementById('cumulativeBalanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: balanceData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })),
            datasets: [{
                label: 'Cumulative Balance',
                data: balanceData.map(d => d.balance),
                borderColor: '#2196F3',
                fill: true,
                backgroundColor: 'rgba(33, 150, 243, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createCustomerGrowthChart(transactions) {
    const customersByMonth = {};
    const uniqueCustomers = new Set();
    
    transactions
        .filter(t => t.amount > 0 && t.category !== 'personal')
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(t => {
            const date = new Date(t.date);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            uniqueCustomers.add(t.name);
            customersByMonth[monthYear] = uniqueCustomers.size;
        });

    const labels = Object.keys(customersByMonth).sort();
    const data = labels.map(month => customersByMonth[month]);

    const ctx = document.getElementById('customerGrowthChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(month => {
                const [year, monthNum] = month.split('-');
                return new Date(year, monthNum - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'Total Customers',
                data: data,
                borderColor: '#9C27B0',
                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createTransactionDistributionChart(transactions) {
    const amounts = transactions
        .filter(t => t.category !== 'transfer')
        .map(t => Math.abs(t.amount));

    // Create buckets for different amount ranges
    const buckets = {
        '0-10': 0,
        '10-25': 0,
        '25-50': 0,
        '50-100': 0,
        '100-250': 0,
        '250-500': 0,
        '500+': 0
    };

    amounts.forEach(amount => {
        if (amount <= 10) buckets['0-10']++;
        else if (amount <= 25) buckets['10-25']++;
        else if (amount <= 50) buckets['25-50']++;
        else if (amount <= 100) buckets['50-100']++;
        else if (amount <= 250) buckets['100-250']++;
        else if (amount <= 500) buckets['250-500']++;
        else buckets['500+']++;
    });

    const ctx = document.getElementById('transactionDistributionChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Number of Transactions',
                data: Object.values(buckets),
                backgroundColor: '#FF9800'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                },
                x: {
                    title: {
                        display: true,
                        text: 'Transaction Amount Range ($)'
                    }
                }
            }
        }
    });
}

function createDailyPatternChart(transactions) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyCounts = new Array(7).fill(0);
    const dailyVolume = new Array(7).fill(0);

    transactions.forEach(t => {
        const date = new Date(t.date);
        const dayIndex = date.getDay();
        dailyCounts[dayIndex]++;
        dailyVolume[dayIndex] += Math.abs(t.amount);
    });

    const ctx = document.getElementById('dailyPatternChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: daysOfWeek,
            datasets: [{
                label: 'Number of Transactions',
                data: dailyCounts,
                backgroundColor: '#2196F3',
                yAxisID: 'y'
            }, {
                label: 'Transaction Volume ($)',
                data: dailyVolume,
                type: 'line',
                borderColor: '#4CAF50',
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    position: 'left'
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function createCategoryDistributionChart(transactions) {
    const categoryData = transactions.reduce((acc, t) => {
        if (t.category && t.category !== 'transfer') {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
        }
        return acc;
    }, {});

    const ctx = document.getElementById('categoryDistributionChart').getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#FF9800', '#2196F3', '#4CAF50', '#9C27B0', 
                    '#F44336', '#00BCD4', '#FFC107', '#795548'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return `${formatCurrency(context.raw)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createPaymentMethodsChart(transactions) {
    const methodData = transactions
        .filter(t => t.amount > 0 && t.name.trim() !== '' && !['Reversal of General Account Hold', 'Refunds', 'Tax collected by partner'].includes(t.type)) // Only consider incoming payments from named businesses or people
        .reduce((acc, t) => {
            const method = t.type || 'Other';
            acc[method] = (acc[method] || 0) + t.amount;
            return acc;
        }, {});

    const ctx = document.getElementById('paymentMethodsChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(methodData),
            datasets: [{
                data: Object.values(methodData),
                backgroundColor: [
                    '#3F51B5', '#E91E63', '#009688', '#FF5722',
                    '#607D8B', '#9C27B0', '#795548', '#FFEB3B'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function createSeasonalRevenueChart(transactions) {
    const seasons = {
        'Winter': [12, 1, 2],
        'Spring': [3, 4, 5],
        'Summer': [6, 7, 8],
        'Fall': [9, 10, 11]
    };

    const yearlySeasonData = transactions
        .filter(t => t.amount > 0 && t.category !== 'transfer')
        .reduce((acc, t) => {
            const date = new Date(t.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const season = Object.entries(seasons).find(([_, months]) => months.includes(month))[0];
            
            if (!acc[year]) acc[year] = {'Winter': 0, 'Spring': 0, 'Summer': 0, 'Fall': 0};
            acc[year][season] += t.amount;
            return acc;
        }, {});

    const years = Object.keys(yearlySeasonData);
    const datasets = Object.keys(seasons).map(season => ({
        label: season,
        data: years.map(year => yearlySeasonData[year][season]),
        borderColor: {
            'Winter': '#2196F3',
            'Spring': '#4CAF50',
            'Summer': '#FFC107',
            'Fall': '#FF5722'
        }[season],
        fill: false
    }));

    const ctx = document.getElementById('seasonalRevenueChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function updateSummaryCards(transactions) {
    // Calculate total income (excluding transfers, refunds, and personal transactions)
    const income = transactions
        .filter(t => t.amount > 0 && !['transfer', 'refund', 'personal'].includes(t.category))
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate total expenses (excluding transfers, refunds, and personal transactions)
    const expenses = transactions
        .filter(t => t.amount < 0 && !['transfer', 'refund', 'personal'].includes(t.category))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
    document.getElementById('netBalance').textContent = formatCurrency(income - expenses);
}

function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

function analyzeTransactions(transactions) {
    const businessTransactions = transactions.filter(t => t.category !== 'personal');
    
    // Calculate months between first and last transaction
    const dates = businessTransactions.map(t => new Date(t.date));
    const firstDate = new Date(Math.min(...dates));
    const lastDate = new Date(Math.max(...dates));
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth()) + 1;

    // Calculate revenue growth (comparing first half vs second half)
    const midPoint = new Date((firstDate.getTime() + lastDate.getTime()) / 2);
    const firstHalfRevenue = businessTransactions
        .filter(t => new Date(t.date) < midPoint && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    const secondHalfRevenue = businessTransactions
        .filter(t => new Date(t.date) >= midPoint && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
    const revenueGrowth = ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100;

    // Calculate retention metrics
    const customerRetention = calculateRetentionMetrics(businessTransactions);

    const analytics = {
        totalCustomers: new Set(businessTransactions.filter(t => t.amount > 0).map(t => t.name)).size,
        repeatCustomers: getRepeatCustomers(businessTransactions),
        averageTransaction: businessTransactions.length > 0 ? 
            businessTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / businessTransactions.length : 0,
        medianTransaction: getMedianTransaction(businessTransactions),
        totalTransactions: businessTransactions.length,
        totalRevenue: businessTransactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0),
        avgMonthlyRevenue: businessTransactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) / monthsDiff,
        peakMonths: getPeakMonths(businessTransactions),
        timeDistribution: getTimeDistribution(businessTransactions),
        topCustomers: getTopCustomers(businessTransactions),
        topVendors: getTopVendors(businessTransactions),
        revenueGrowth: revenueGrowth,
        customerRetention
    };
    
    updateAnalyticsDisplay(analytics);
}

function calculateRetentionMetrics(transactions) {
    const customerTransactions = {};
    
    // Group transactions by customer
    transactions
        .filter(t => t.amount > 0)
        .forEach(t => {
            if (!customerTransactions[t.name]) {
                customerTransactions[t.name] = [];
            }
            customerTransactions[t.name].push({
                date: new Date(t.date),
                amount: t.amount
            });
        });

    const totalCustomers = Object.keys(customerTransactions).length;
    const returningCustomers = Object.values(customerTransactions)
        .filter(dates => dates.length > 1).length;
    
    // Calculate average customer age in days
    const avgAge = Object.values(customerTransactions).reduce((sum, dates) => {
        const firstDate = Math.min(...dates.map(d => d.date));
        const lastDate = Math.max(...dates.map(d => d.date));
        return sum + (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    }, 0) / totalCustomers;

    // Calculate customer lifetime value (average total revenue per customer)
    const lifetimeValue = Object.values(customerTransactions).reduce((sum, transactions) => {
        return sum + transactions.reduce((customerSum, t) => customerSum + t.amount, 0);
    }, 0) / totalCustomers;

    // Calculate monthly churn rate
    const monthlyChurn = calculateChurnRate(customerTransactions);

    // Count loyal customers (3+ transactions)
    const loyalCustomers = Object.values(customerTransactions)
        .filter(dates => dates.length >= 3).length;

    return {
        returningRate: (returningCustomers / totalCustomers) * 100,
        avgCustomerAge: avgAge,
        loyalCustomers,
        lifetimeValue,
        monthlyChurn
    };
}

function calculateChurnRate(customerTransactions) {
    // Get all unique months in the dataset
    const allDates = Object.values(customerTransactions)
        .flat()
        .map(t => t.date)
        .sort((a, b) => a - b);
    
    if (allDates.length < 2) return 0;

    const firstDate = allDates[0];
    const lastDate = allDates[allDates.length - 1];
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth());
    
    if (monthsDiff === 0) return 0;

    // Count customers who haven't returned in the last month
    const lastMonth = new Date(lastDate);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const churnedCustomers = Object.values(customerTransactions)
        .filter(transactions => {
            const lastTransaction = Math.max(...transactions.map(t => t.date));
            return lastTransaction < lastMonth;
        }).length;

    return (churnedCustomers / Object.keys(customerTransactions).length) * 100;
}

function getRepeatCustomers(transactions) {
    const customerCounts = {};
    transactions.forEach(t => {
        if (t.amount > 0 && t.category !== 'personal' && t.name.trim() !== '') {
            customerCounts[t.name] = (customerCounts[t.name] || 0) + 1;
        }
    });
    const repeatCount = Object.entries(customerCounts)
        .filter(([_, count]) => count > 1)
        .length;
    return {
        count: repeatCount,
        percentage: (repeatCount / Object.keys(customerCounts).length) * 100
    };
}

function getMedianTransaction(transactions) {
    const amounts = transactions.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
    const mid = Math.floor(amounts.length / 2);
    return amounts.length % 2 !== 0 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
}

function getPeakMonths(transactions) {
    const monthlyTotals = {};
    transactions
        .filter(t => t.amount > 0 && t.category !== 'personal')
        .forEach(t => {
            const [month, day, year] = t.date.split('/');
            const monthYear = `${year}-${month}`;
            monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + t.amount;
        });
    return Object.entries(monthlyTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0,5);
}

function formatMonth(monthYear) {
    const [year, month] = monthYear.split('-');
    const date = new Date(`${year}-${month}-01`);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function getTimeDistribution(transactions) {
    const hourly = new Array(24).fill(0);
    transactions
        .filter(t => t.category !== 'personal')
        .forEach(t => {
            const hour = new Date(`${t.date} ${t.time}`).getHours();
            hourly[hour]++;
        });

    // Convert to array of [hour, count] pairs and sort by count
    return Array.from(hourly.entries())
        .map(([hour, count]) => ({
            hour,
            count,
            formattedHour: formatHour(hour)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Get top 5 busiest hours
}

function formatHour(hour) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:00 ${ampm}`;
}

function getTopCustomers(transactions) {
    const customerTotals = {};
    transactions
        .filter(t => t.amount > 0 && t.category !== 'personal' && t.name.trim() !== '')
        .forEach(t => {
            customerTotals[t.name] = (customerTotals[t.name] || 0) + t.amount;
        });
    return Object.entries(customerTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
}

function getTopVendors(transactions) {
    const vendorTotals = {};
    transactions
        .filter(t => t.amount < 0 && t.category !== 'personal' && t.name.trim() !== '')
        .forEach(t => {
            vendorTotals[t.name] = (vendorTotals[t.name] || 0) + Math.abs(t.amount);
        });
    return Object.entries(vendorTotals)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
}

function updateAnalyticsDisplay(analytics) {
    // Update customer stats
    document.getElementById('totalCustomers').textContent = analytics.totalCustomers;
    document.getElementById('repeatCustomers').textContent = `${analytics.repeatCustomers.count} (${analytics.repeatCustomers.percentage.toFixed(2)}%)`;
    document.getElementById('avgTransaction').textContent = formatCurrency(analytics.averageTransaction);
    document.getElementById('medianTransaction').textContent = formatCurrency(analytics.medianTransaction);
    document.getElementById('totalTransactions').textContent = analytics.totalTransactions;
    document.getElementById('avgMonthlyRevenue').textContent = formatCurrency(analytics.avgMonthlyRevenue);

    // Update top customers list
    const topCustomersList = document.getElementById('topCustomersList');
    topCustomersList.innerHTML = analytics.topCustomers
        .filter(([name]) => name.trim() !== '') // Exclude blank names
        .map(([name, amount, originalAmount, originalCurrency]) => `
            <div class="item">
                <span>${name}</span>
                <span>${formatCurrency(amount)}${originalCurrency ? 
                    ` (${formatCurrency(originalAmount, originalCurrency)})` : 
                    ''}</span>
            </div>
        `).join('');

    // Update peak months
    const peakMonthsList = document.getElementById('peakMonthsList');
    peakMonthsList.innerHTML = analytics.peakMonths
        .map(([month, amount]) => `
            <div class="item">
                <span>${formatMonth(month)}</span>
                <span>${formatCurrency(amount)}</span>
            </div>
        `).join('');

    // Update time distribution
    const timeDistribution = document.getElementById('timeDistribution');
    timeDistribution.innerHTML = analytics.timeDistribution
        .map(({formattedHour, count}) => `
            <div class="item">
                <span>${formattedHour}</span>
                <span>${count} transactions</span>
            </div>
        `).join('');

    // Update top vendors list
    const topVendorsList = document.getElementById('topVendorsList');
    topVendorsList.innerHTML = analytics.topVendors
        .map(([name, amount]) => `
            <div class="item">
                <span>${name}</span>
                <span>${formatCurrency(amount)}</span>
            </div>
        `).join('');

    // Update retention metrics
    document.getElementById('returningRate').textContent = 
        `${analytics.customerRetention.returningRate.toFixed(1)}%`;
    document.getElementById('avgCustomerAge').textContent = 
        `${Math.round(analytics.customerRetention.avgCustomerAge)} days`;
    document.getElementById('loyalCustomers').textContent = 
        analytics.customerRetention.loyalCustomers.toString();
    document.getElementById('customerLifetimeValue').textContent = 
        formatCurrency(analytics.customerRetention.lifetimeValue);
    document.getElementById('monthlyChurn').textContent = 
        `${analytics.customerRetention.monthlyChurn.toFixed(1)}%`;
}

function formatMonth(dateStr) {
    const [month, day, year] = dateStr.split('/');
    const date = new Date(`${year}-${month}-01`);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function initializePeriodSelectors(transactions) {
    const years = new Set();
    const months = new Set();

    transactions.forEach(t => {
        const date = new Date(t.date);
        years.add(date.getFullYear());
        months.add(date.getMonth());
    });

    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');

    // Add years
    [...years].sort().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelector.appendChild(option);
    });

    // Add months
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    [...months].sort().forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = monthNames[month];
        monthSelector.appendChild(option);
    });

    // Add event listeners
    yearSelector.addEventListener('change', () => filterTransactions());
    monthSelector.addEventListener('change', () => filterTransactions());
}

function filterTransactions() {
    const year = document.getElementById('yearSelector').value;
    const month = document.getElementById('monthSelector').value;
    
    let filtered = [...transactions];

    if (year !== 'all') {
        filtered = filtered.filter(t => new Date(t.date).getFullYear() === parseInt(year));
    }
    
    if (month !== 'all') {
        filtered = filtered.filter(t => new Date(t.date).getMonth() === parseInt(month));
    }

    // Update the entire dashboard with filtered data
    updateDashboard(filtered);

    // Update period display
    const periodDisplay = document.getElementById('periodDisplay');
    const periodText = getPeriodText(year, month);
    periodDisplay.textContent = periodText;
}

function getPeriodText(year, month) {
    if (year === 'all' && month === 'all') return 'All Time';
    if (year === 'all') return monthNames[parseInt(month)];
    if (month === 'all') return year;
    return `${monthNames[parseInt(month)]} ${year}`;
}

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function updateTimeDistribution(timeDistribution) {
    const maxCount = Math.max(...timeDistribution);
    const container = document.getElementById('timeDistribution');
    container.innerHTML = timeDistribution
        .map((count, hour) => {
            const intensity = count > 0 ? (count / maxCount) * 100 : 0;
            return `
                <div class="time-block ${count > 0 ? 'active' : ''}" 
                     style="background-color: ${count > 0 ? `rgba(0, 120, 212, ${intensity/100})` : '#f0f0f0'}">
                    <div class="time-block-content">
                        <span class="time-block-hour">${hour}:00</span>
                        <span class="time-block-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');
}
