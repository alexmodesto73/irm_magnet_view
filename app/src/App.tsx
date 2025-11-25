import { useEffect, useState } from 'react';
import Map from './components/Map';
import EducationalPanel from './components/EducationalPanel';
import { loadData } from './utils/dataLoader';
import type { DataPoint } from './utils/dataLoader';
import './App.css';
import 'leaflet/dist/leaflet.css';

function App() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [viewState, setViewState] = useState({
    longitude: 5.970,
    latitude: 45.546,
    zoom: 16,
    pitch: 45,
    bearing: 0
  });
  const [hoverInfo, setHoverInfo] = useState<any>(null);

  useEffect(() => {
    console.log('Loading data...');
    loadData()
      .then(d => {
        console.log('Data loaded:', d.length, 'points');
        setData(d);
      })
      .catch(e => console.error('Error loading data:', e));
  }, []);

  // Auto-center map on data load
  useEffect(() => {
    if (data.length > 0) {
      const mid = Math.floor(data.length / 2);
      console.log('Centering map on:', data[mid].coordinates);
      setViewState(v => ({
        ...v,
        longitude: data[mid].coordinates[0],
        latitude: data[mid].coordinates[1]
      }));
    }
  }, [data]);

  return (
    <div className="app-container">
      <Map
        data={data}
        viewState={viewState}
        onViewStateChange={setViewState}
        setHoverInfo={setHoverInfo}
      />
      <EducationalPanel hoverInfo={hoverInfo} />
    </div>
  );
}

export default App;
