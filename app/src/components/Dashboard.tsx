
import type { DataPoint } from '../utils/dataLoader';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface DashboardProps {
    data: DataPoint[];
    hoverInfo: any;
}

export default function Dashboard({ data, hoverInfo }: DashboardProps) {
    if (!data || data.length === 0) return <div className="dashboard loading">Loading data...</div>;

    const maxMag = Math.max(...data.map(d => d.magnitude));
    const minMag = Math.min(...data.map(d => d.magnitude));
    const avgMag = data.reduce((acc, d) => acc + d.magnitude, 0) / data.length;

    const chartData = {
        labels: data.map((_, i) => i), // Simplified time labels
        datasets: [
            {
                label: 'Magnitude (µT)',
                data: data.map(d => d.magnitude),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                pointRadius: 0,
                borderWidth: 1,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Magnetic Field Magnitude',
                color: '#fff'
            },
        },
        scales: {
            x: { display: false },
            y: {
                grid: { color: '#333' },
                ticks: { color: '#ccc' }
            }
        }
    };

    return (
        <div className="dashboard">
            <h2>IRM Magnet View</h2>
            <div className="stats">
                <div className="stat-item">
                    <span className="label">Max</span>
                    <span className="value">{maxMag.toFixed(2)} µT</span>
                </div>
                <div className="stat-item">
                    <span className="label">Min</span>
                    <span className="value">{minMag.toFixed(2)} µT</span>
                </div>
                <div className="stat-item">
                    <span className="label">Avg</span>
                    <span className="value">{avgMag.toFixed(2)} µT</span>
                </div>
            </div>

            <div className="chart-container">
                <Line data={chartData} options={options} />
            </div>

            {hoverInfo && hoverInfo.object && (
                <div className="hover-info">
                    <h3>Current Point</h3>
                    <p>Mag: {hoverInfo.object.magnitude.toFixed(2)} µT</p>
                    <p>X: {hoverInfo.object.mag_x.toFixed(2)}</p>
                    <p>Y: {hoverInfo.object.mag_y.toFixed(2)}</p>
                    <p>Z: {hoverInfo.object.mag_z.toFixed(2)}</p>
                </div>
            )}
        </div>
    );
}
