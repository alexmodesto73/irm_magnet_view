import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { DataPoint } from '../utils/dataLoader';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
    data: DataPoint[];
    viewState: any;
    onViewStateChange: (viewState: any) => void;
    setHoverInfo: (info: any) => void;
}

export default function Map({ data, viewState, onViewStateChange, setHoverInfo }: MapProps) {
    console.log('Map rendering. Data points:', data.length);
    console.log('Current ViewState:', viewState);

    const layers = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Color scale for magnitude
        const minMag = Math.min(...data.map(d => d.magnitude));
        const maxMag = Math.max(...data.map(d => d.magnitude));
        console.log('Magnitude range:', minMag, maxMag);

        const getColor = (d: DataPoint): [number, number, number, number] => {
            let t = (d.magnitude - minMag) / (maxMag - minMag);
            if (isNaN(t)) t = 0.5;
            // Blue to Red gradient
            return [255 * t, 0, 255 * (1 - t), 255]; // Alpha 255
        };

        return [
            new PathLayer<DataPoint[]>({
                id: 'path-layer',
                data: [data],
                getPath: (d: DataPoint[]) => d.map(p => [p.coordinates[0], p.coordinates[1]]), // Force 2D
                getColor: [0, 255, 0, 255], // Green path
                getWidth: 5,
                widthMinPixels: 2
            }),
            new ScatterplotLayer<DataPoint>({
                id: 'scatter-layer',
                data,
                getPosition: (d: DataPoint) => [d.coordinates[0], d.coordinates[1]], // Force 2D
                getFillColor: getColor,
                getRadius: 5,
                radiusMinPixels: 5,
                pickable: true,
                onHover: info => setHoverInfo(info)
            })
        ];
    }, [data, setHoverInfo]);

    return (
        <DeckGL
            viewState={viewState}
            onViewStateChange={e => onViewStateChange(e.viewState)}
            controller={true}
            layers={layers}
            getTooltip={({ object }) => object && `Magnitude: ${object.magnitude.toFixed(2)} µT`}
            parameters={{
                // @ts-ignore
                clearColor: [0.1, 0.1, 0.1, 1] // Dark grey
            }}
            style={{ width: '100%', height: '100%' }}
        >
        </DeckGL>
    );
}
