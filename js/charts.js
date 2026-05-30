// js/charts.js
let barChart, pieChart, donutChart, trendChart;

function initCharts() {
  Chart.defaults.font.family = "'Space Mono', monospace";

  barChart = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Inc', 'Bills', 'Exp', 'Save'],
      datasets: [
        { label: 'Plan',   data: [], backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
        { label: 'Actual', data: [], backgroundColor: '#6a9fff', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { display: false },
        x: { grid: { display: false }, ticks: { color: '#3a3a48', font: { size: 9 } } }
      }
    }
  });

  pieChart = new Chart(document.getElementById('pieChart').getContext('2d'), {
    type: 'pie',
    data: {
      labels: [],
      datasets: [{ data: [], backgroundColor: ['#5ad4a0','#6a9fff','#e0a05a','#a57aff','#e07a7a','#5ab4d4'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#3a3a48', font: { size: 9 }, boxWidth: 9, padding: 6 } } }
    }
  });

  donutChart = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Spent', 'Remaining'],
      datasets: [{ data: [], backgroundColor: ['rgba(255,255,255,0.08)', '#5ad4a0'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: { legend: { display: false } }
    }
  });

  trendChart = new Chart(document.getElementById('trendChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Savings', data: [], borderColor: '#5ad4a0', backgroundColor: 'rgba(90,212,160,0.08)', tension: 0.4, pointRadius: 3, fill: true, borderWidth: 2 },
        { label: 'Income',  data: [], borderColor: '#6a9fff', backgroundColor: 'transparent', tension: 0.4, pointRadius: 3, borderWidth: 2 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#3a3a48', font: { size: 9 }, callback: v => '$' + v.toLocaleString() } },
        x: { grid: { display: false }, ticks: { color: '#3a3a48', font: { size: 9 } } }
      }
    }
  });
}

function updateCharts(data, trendData) {
  const sum = (arr, k) => arr.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
  const income   = { plan: sum(data.income,'planned'),   actual: sum(data.income,'actual') };
  const bills    = { plan: sum(data.bills,'planned'),    actual: sum(data.bills,'actual') };
  const expenses = { plan: sum(data.expenses,'planned'), actual: sum(data.expenses,'actual') };
  const savings  = { plan: sum(data.savings,'planned'),  actual: sum(data.savings,'actual') };
  const spent = bills.actual + expenses.actual + savings.actual;
  const rem   = income.actual - spent;

  barChart.data.datasets[0].data = [income.plan, bills.plan, expenses.plan, savings.plan];
  barChart.data.datasets[1].data = [income.actual, bills.actual, expenses.actual, savings.actual];
  barChart.update();

  pieChart.data.labels = data.expenses.map(e => e.name);
  pieChart.data.datasets[0].data = data.expenses.map(e => parseFloat(e.actual) || 0);
  pieChart.update();

  donutChart.data.datasets[0].data = [spent, rem > 0 ? rem : 0];
  donutChart.update();

  if (trendData && trendData.length) {
    trendChart.data.labels   = trendData.map(t => t.label);
    trendChart.data.datasets[0].data = trendData.map(t => t.savings);
    trendChart.data.datasets[1].data = trendData.map(t => t.income);
    trendChart.update();
  }
}
