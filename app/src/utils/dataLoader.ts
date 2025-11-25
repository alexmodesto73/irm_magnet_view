export interface DataPoint {
    time: number;
    coordinates: [number, number, number]; // lon, lat, alt
    mag_x: number;
    mag_y: number;
    mag_z: number;
    magnitude: number;
}

export async function loadData(): Promise<DataPoint[]> {
    try {
        const response = await fetch('./data.geojson');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const json = await response.json();
        console.log('GeoJSON loaded:', json);

        return json.features.map((f: any) => ({
            time: f.properties.time,
            coordinates: f.geometry.coordinates,
            mag_x: f.properties.mag_x,
            mag_y: f.properties.mag_y,
            mag_z: f.properties.mag_z,
            magnitude: f.properties.magnitude
        }));
    } catch (error) {
        console.error('Failed to load data:', error);
        return [];
    }
}
