`<a id="readme-top"></a>`

[Contributors][contributors-url]
[MIT License][license-url]
[LinkedIn][linkedin-url]

<br />
<div align="center">
  <h3 align="center">PPalytics</h3>

<p align="center">
    A powerful, browser-based analytics tool for PayPal transaction data with advanced visualization and business insights
    <br />
    <a href="https://github.com/jandreanalytics/paypal-transaction-dashboard"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://jkandre.science/projects/paypal-dashboard">View Demo</a>
    ·
    <a href="https://github.com/jandreanalytics/paypal-transaction-dashboard/issues">Report Bug</a>
    ·
    <a href="https://github.com/jandreanalytics/paypal-transaction-dashboard/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#key-features">Key Features</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#privacy-and-security">Privacy & Security</a></li>
    <li><a href="#development-story">Development Story</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About The Project

<div align="center">
  <img src="images/dashboard-preview.png" alt="Dashboard Preview">
</div>

The PayPal Transaction Dashboard is a client-side web application I developed to solve a common challenge faced by small business owners and freelancers: making sense of their PayPal transaction data. What started as a personal tool to analyze my own business transactions evolved into a comprehensive analytics platform that helps users:

- Visualize income and expense patterns
- Track customer retention and growth
- Identify business trends and seasonality
- Generate tax-ready reports
- Monitor recurring payments

### Origin Story

I built this tool initially for my own use when I noticed PayPal's built-in analytics weren't providing the depth of insight I needed for business decisions. After sharing it with other freelancers and receiving positive feedback, I refined it into a more comprehensive solution that could help others in similar situations.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Key Features

- 📊 **12 Interactive Visualizations** including income vs expenses, customer growth, and seasonal patterns
- 🔄 **Automatic Business Transaction Detection** with smart categorization
- 📈 **Customer Retention Analytics** with detailed metrics and trends
- 💰 **Tax Preparation Tools** with quarterly breakdowns and category sorting
- 🔒 **100% Client-Side Processing** for maximum privacy and security
- 📱 **Responsive Design** that works on all devices
- 📥 **Excel Report Export** for accounting and tax purposes

### Privacy & Security Focus

- No server uploads required
- All data processing happens in your browser
- No data storage or collection
- Works offline after initial page load

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

* ![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
* ![Chart.js](https://img.shields.io/badge/chart.js-F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white)
* ![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
* ![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

1. Visit the [dashboard website](https://jkandre.science/projects/paypal-dashboard)
2. Export your PayPal data:
   ```
   PayPal.com -> Activity -> Statements -> Download
   Select "Balance affecting payments"
   Choose CSV format
   ```
3. Drop the CSV file into the dashboard
4. Start exploring your business insights

### Local Installation

1. Clone the repository
   ```sh
   git clone https://github.com/jandreanalytics/paypal-transaction-dashboard.git
   ```
2. Open index.html in your browser

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Development Story

This project showcases several key technical achievements:

### Smart Transaction Categorization

- Machine learning-inspired pattern matching system
- Vendor name normalization to handle variations in PayPal transaction descriptions
- Automatic business expense detection using comprehensive keyword database
- Custom categorization rules based on transaction patterns

### Data Processing

- Complex CSV parsing with support for multiple PayPal export formats
- Handling of currency conversions and international transactions
- Intelligent recurring payment detection
- Multi-currency transaction normalization

### Financial Analytics

- Customizable date range analysis
- Customer retention metrics including:
  - Customer lifetime value
  - Churn rate calculation
  - Loyalty tracking
  - Return customer analysis
- Business performance indicators:
  - Seasonal trends
  - Daily transaction patterns
  - Peak business hours
  - Revenue growth tracking

### Tax Preparation Features

- Quarterly performance breakdowns
- Business expense categorization
- Income source analysis
- Customizable Excel report generation
- Year-over-year comparisons

### Technical Implementation

#### Performance Optimizations

- Efficient data structures for large transaction sets
- Lazy loading of visualization components
- Optimized chart rendering for smooth interactions
- Client-side caching for faster re-renders

#### Security Considerations

- No server-side processing required
- All data stays in the browser
- No external API dependencies
- Works offline after initial load
- No data persistence between sessions

#### Visualization Engine

- Dynamic chart generation using Chart.js
- Responsive design adaptation
- Interactive data exploration
- Real-time filtering and updates

#### Data Export Capabilities

- Multiple export formats
- Customizable report templates
- Tax-ready summaries
- Transaction audit trails

## Usage Examples

### Business Analysis

```javascript
// Example of how the transaction categorization works
const transaction = {
    name: "Adobe Creative Cloud",
    type: "Subscription Payment",
    amount: -52.99
};

const category = detectCategory(transaction.name, transaction.type);
// Returns: "subscription"
```

### Transaction Pattern Detection

```javascript
// Example of recurring payment detection
const transactions = [
    { name: "Netflix", amount: -15.99, date: "2023-01-01" },
    { name: "Netflix", amount: -15.99, date: "2023-02-01" },
    { name: "Netflix", amount: -15.99, date: "2023-03-01" }
];

const pattern = detectFrequency(transactions);
// Returns: "Monthly"
```

### Report Generation

```javascript
// Example of tax report generation
const yearlyData = {
    income: 50000,
    expenses: 15000,
    categories: {
        "Software": 5000,
        "Services": 10000
    }
};

generateTaxReport(yearlyData);
// Generates detailed Excel report with categorized expenses
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Contact

Jeremy Andre - jeremy@jkandre.science

Portfolio: [jkandre.science](https://jkandre.science)

Project Link: [https://github.com/jandreanalytics/paypal-transaction-dashboard](https://github.com/jandreanalytics/paypal-transaction-dashboard)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

````

````

[contributors-shield]: https://img.shields.io/github/contributors/jandreanalytics/paypal-transaction-dashboard.svg?style=for-the-badge
[contributors-url]: https://github.com/jandreanalytics/paypal-transaction-dashboard/graphs/contributors
[license-shield]: https://img.shields.io/github/license/jandreanalytics/paypal-transaction-dashboard.svg?style=for-the-badge
[license-url]: https://github.com/jandreanalytics/paypal-transaction-dashboard/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://www.linkedin.com/in/jeremy-andre-a18925241/
