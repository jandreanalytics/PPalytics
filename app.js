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
            // Only update summary cards initially
            updateSummaryCards(transactions);
            dashboard.classList.remove('hidden');
            
            const recurring = detectRecurringPayments(transactions);
            if (recurring && recurring.length > 0) {
                showRecurringModal(recurring);
            } else {
                // If no recurring payments to categorize, create charts immediately
                updateCharts(transactions);
            }
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // Split by comma but respect quoted values
        const values = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
            .map(val => val.replace(/"/g, ''));

        // Map PayPal CSV columns to our transaction object
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

        // Only include completed transactions
        if (transaction.status === 'Completed') {
            transactions.push(transaction);
        }
    }

    return transactions;
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
        'frost dragon inc': 'Fur Affinity'
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
        'hootsuite', 'wordpress',
        
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
        'subscription', 'recurring'
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
        updateCharts(transactions); // Create charts after categorization
        modal.classList.add('hidden');
    };
    
    document.getElementById('dismissBtn').onclick = () => {
        modal.classList.add('hidden');
        updateCharts(transactions); // Create charts if user dismisses modal
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
    updateDashboard(transactions);
}

function updateDashboard(transactions) {
    updateSummaryCards(transactions);
    // Don't automatically update charts here anymore
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

let incomeChart = null;
let categoryChart = null;

function updateCharts(transactions) {
    // Destroy existing charts if they exist
    if (incomeChart) {
        incomeChart.destroy();
    }
    if (categoryChart) {
        categoryChart.destroy();
    }

    // Income over time chart
    const incomeData = aggregateByMonth(transactions.filter(t => t.amount > 0));
    incomeChart = new Chart(document.getElementById('incomeChart'), {
        type: 'line',
        data: {
            labels: Object.keys(incomeData),
            datasets: [{
                label: 'Monthly Income',
                data: Object.values(incomeData),
                borderColor: '#0066cc'
            }]
        }
    });

    // Category breakdown chart
    const categoryData = aggregateByCategory(transactions);
    categoryChart = new Chart(document.getElementById('categoryChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: ['#0066cc', '#00cc66', '#cc6600', '#cc0066']
            }]
        }
    });
}

function aggregateByMonth(transactions) {
    const monthly = {};
    transactions.forEach(t => {
        const month = t.date.substring(0, 7);
        monthly[month] = (monthly[month] || 0) + t.amount;
    });
    return monthly;
}

function aggregateByCategory(transactions) {
    const categories = {};
    transactions.forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
    });
    return categories;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}
