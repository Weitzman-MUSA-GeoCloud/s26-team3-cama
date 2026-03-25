document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Map
    const map = L.map('map').setView([39.9526, -75.1652], 13);

    // Professional Basemap: CartoDB Positron (Light)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
    }).addTo(map);

    // Add a sample marker (1234 Sesame St)
    const marker = L.marker([39.9526, -75.1652]).addTo(map);
    marker.bindPopup(`
    <div style="font-family: sans-serif;">
        <strong style="font-size: 1.1rem;">1234 Sesame St</strong><br>
        <span style="color: #666;">Current:</span> $275,400<br>
        <span style="color: #666;">2023:</span> $225,200<br>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 8px 0;">
        <span style="color: #d9534f; font-weight: bold;">Change: ↑ 22.3%</span>
    </div>
    `).openPopup();

    // Interaction: Clicking the marker opens the detail modal
    marker.on('click', () => {
        document.getElementById('detailModal').style.display = 'block';
        initValuationChart();
    });

    // 2. Initialize Sidebar Distribution Charts
    const commonOptions = {
        plugins: { legend: { display: false } },
        scales: { y: { display: false }, x: { grid: { display: false } } },
        elements: { line: { tension: 0.4 }, point: { radius: 0 } }
    };

    // Assessment Value Distribution
    new Chart(document.getElementById('distChart'), {
        type: 'line',
        data: {
            labels: [0, 1, 2, 3, 4, 5],
            datasets: [{
                data: [5, 40, 60, 45, 20, 5],
                fill: true,
                backgroundColor: 'rgba(200, 200, 200, 0.5)',
                borderColor: '#888'
            }]
        },
        options: commonOptions
    });

    // Percent Change Distribution
    new Chart(document.getElementById('changeChart'), {
        type: 'line',
        data: {
            labels: [-50, 0, 50, 100, 150, 200],
            datasets: [{
                data: [2, 10, 70, 40, 15, 5],
                fill: true,
                backgroundColor: 'rgba(200, 200, 200, 0.5)',
                borderColor: '#888'
            }]
        },
        options: commonOptions
    });

    // 3. Modal Functionality
    const modal = document.getElementById('detailModal');
    document.querySelector('.close-btn').onclick = () => modal.style.display = 'none';
    window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

    // 4. Property Detail Line Chart (Image 2)
    function initValuationChart() {
        const ctx = document.getElementById('valuationLineChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['2022', '', '2023', '', '2024'],
                datasets: [{
                    label: 'Valuation',
                    data: [46000, 55000, 152000, 160000, 180000],
                    borderColor: '#4a90e2',
                    fill: false,
                    borderDash: [5, 5], // Example of projected dashed line
                    segment: {
                        borderDash: ctx => ctx.p0.parsed.x >= 2 ? [5, 5] : undefined
                    }
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: false } }
            }
        });
    }
});
