import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polygon, Polyline } from 'react-leaflet';
import type { DataPoint } from '../utils/dataLoader';
import 'leaflet/dist/leaflet.css';

interface MapProps {
    data: DataPoint[];
    viewState: {
        longitude: number;
        latitude: number;
        zoom: number;
    };
    onViewStateChange: (viewState: any) => void;
    setHoverInfo: (info: any) => void;
}

// Component to handle view state updates from props
function RecenterMap({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lon], zoom);
    }, [lat, lon, zoom, map]);
    return null;
}

function Legend({ min, max }: { min: number; max: number }) {
    return (
        <div style={{
            position: 'absolute',
            bottom: '30px',
            right: '10px',
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '10px',
            borderRadius: '5px',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'sans-serif'
        }}>
            <h4 style={{ margin: '0 0 5px 0' }}>Champ Magnétique (µT, Log)</h4>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ width: '20px', height: '10px', background: 'blue', marginRight: '5px' }}></div>
                <span>{min.toFixed(1)} (Faible)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ width: '20px', height: '10px', background: 'linear-gradient(to right, blue, cyan, lime, yellow, red)', flex: 1 }}></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '20px', height: '10px', background: 'red', marginRight: '5px' }}></div>
                <span>{max.toFixed(1)} (Élevé)</span>
            </div>
            <div style={{ marginTop: '10px', borderTop: '1px solid #555', paddingTop: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ width: '20px', height: '2px', background: 'red', borderTop: '1px dashed red', marginRight: '5px' }}></div>
                    <span>Trajectoire Théorique (Corrigée)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '20px', height: '2px', background: 'rgba(255, 255, 255, 0.3)', marginRight: '5px' }}></div>
                    <span>Lignes de Champ (Théorique)</span>
                </div>
            </div>
        </div>
    );
}

export default function Map({ data, viewState, setHoverInfo }: MapProps) {
    const [buildings, setBuildings] = useState<any[]>([]);
    const [activeFieldLine, setActiveFieldLine] = useState<[number, number][]>([]);

    // Calculate dipole field lines (static background)
    // Calculate theoretical trajectory (Linear Regression)
    const theoreticalPath = useMemo(() => {
        if (data.length < 2) return [];

        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        let sumLon = 0, sumLonX = 0;

        // We treat index as x-axis (assuming roughly constant sampling rate)
        // Y is Latitude, Z is Longitude
        for (let i = 0; i < n; i++) {
            const lat = data[i].coordinates[1];
            const lon = data[i].coordinates[0];

            sumX += i;
            sumY += lat;
            sumXY += i * lat;
            sumXX += i * i;

            sumLon += lon;
            sumLonX += i * lon;
        }

        const slopeLat = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const interceptLat = (sumY - slopeLat * sumX) / n;

        const slopeLon = (n * sumLonX - sumX * sumLon) / (n * sumXX - sumX * sumX);
        const interceptLon = (sumLon - slopeLon * sumX) / n;

        const path: [number, number][] = [];
        // Generate points for the line
        for (let i = 0; i < n; i++) {
            const lat = slopeLat * i + interceptLat;
            const lon = slopeLon * i + interceptLon;
            path.push([lat, lon]);
        }
        return path;
    }, [data]);

    // Calculate dipole field lines (static background)
    const fieldLines = useMemo(() => {
        if (data.length === 0) return { lines: [], centerLat: 0, centerLon: 0 };

        // Find center (max magnitude)
        const maxPoint = data.reduce((prev, current) => (prev.magnitude > current.magnitude) ? prev : current);
        let centerLat = maxPoint.coordinates[1];
        let centerLon = maxPoint.coordinates[0];

        // Refine center: Find nearest building
        // Priority 1: Building intersecting the GPS track (containing points or crossing edges)
        // Priority 2: Building containing the max point (fallback)
        // Priority 3: Building with closest node (fallback)
        if (buildings.length > 0) {
            let bestCentroid = { lat: centerLat, lon: centerLon };
            let foundIntersect = false;
            let minNodeDist = Infinity;

            // Helper: Ray casting algorithm for point in polygon
            const isPointInPoly = (lat: number, lon: number, poly: [number, number][]) => {
                let inside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = poly[i][0], yi = poly[i][1];
                    const xj = poly[j][0], yj = poly[j][1];
                    const intersect = ((yi > lat) !== (yj > lat))
                        && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                }
                return inside;
            };

            // Helper: Line segment intersection
            const doLineSegmentsIntersect = (p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) => {
                const ccw = (a: [number, number], b: [number, number], c: [number, number]) => {
                    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
                };
                return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
            };

            // Helper: Check if poly intersects track
            // Optimization: Only check segments near the max point or check all? 
            // Checking all might be slow if track is long. Let's check segments with high magnitude?
            // Or just check if ANY point is inside first (fast), then edges.
            const doesPolyIntersectTrack = (poly: [number, number][]) => {
                // 1. Check if any data point is inside
                for (const d of data) {
                    if (isPointInPoly(d.coordinates[1], d.coordinates[0], poly)) return true;
                }
                // 2. Check edge intersections (expensive but necessary if track crosses through)
                // We can skip this if we assume "intersect" means "enters". 
                // But the user said "intersect the trace".
                // Let's sample the track to avoid O(N*M).
                for (let i = 0; i < data.length - 1; i++) {
                    const p1: [number, number] = [data[i].coordinates[1], data[i].coordinates[0]];
                    const p2: [number, number] = [data[i + 1].coordinates[1], data[i + 1].coordinates[0]];

                    for (let j = 0; j < poly.length; j++) {
                        const p3 = poly[j];
                        const p4 = poly[(j + 1) % poly.length];
                        if (doLineSegmentsIntersect(p1, p2, p3, p4)) return true;
                    }
                }
                return false;
            };

            buildings.forEach(poly => {
                // Calculate centroid
                let sumLat = 0, sumLon = 0;
                let currentMinDist = Infinity;

                poly.forEach((p: [number, number]) => {
                    sumLat += p[0];
                    sumLon += p[1];

                    // Distance to nodes (fallback metric)
                    const dLat = p[0] - maxPoint.coordinates[1];
                    const dLon = p[1] - maxPoint.coordinates[0];
                    const dist = dLat * dLat + dLon * dLon;
                    if (dist < currentMinDist) currentMinDist = dist;
                });

                const cLat = sumLat / poly.length;
                const cLon = sumLon / poly.length;

                // Check intersection with track
                if (!foundIntersect && doesPolyIntersectTrack(poly)) {
                    foundIntersect = true;
                    bestCentroid = { lat: cLat, lon: cLon };
                }
                // Fallback: closest node if no intersection found yet
                else if (!foundIntersect && currentMinDist < minNodeDist) {
                    minNodeDist = currentMinDist;
                    bestCentroid = { lat: cLat, lon: cLon };
                }
            });

            // Apply if found intersection OR if closest node is very close
            if (foundIntersect || minNodeDist < 0.0001) {
                centerLat = bestCentroid.lat;
                centerLon = bestCentroid.lon;
            }
        }

        const lines: [number, number][][] = [];
        const numLines = 12; // Number of field lines
        const radius = 0.0005; // Approx scale for the loops

        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * 2 * Math.PI;
            const line: [number, number][] = [];

            // Generate a dipole-like loop
            for (let t = 0; t <= Math.PI; t += 0.1) {
                // Simple parametric equation for a loop
                const r = radius * Math.sin(t);
                const latOffset = r * Math.cos(angle) * 0.5; // Flatten slightly for perspective
                const lonOffset = r * Math.sin(angle);

                // Rotate to align with magnetic north (approx)
                // Assuming simple orientation for visualization
                line.push([centerLat + latOffset, centerLon + lonOffset]);
            }
            lines.push(line);
        }
        return { lines, centerLat, centerLon };
    }, [data, buildings]);

    // Calculate dynamic field line on hover
    const handleHover = (d: DataPoint, e: any) => {
        setHoverInfo({
            object: d,
            x: e.originalEvent.clientX,
            y: e.originalEvent.clientY
        });

        if (data.length === 0) return;

        const { centerLat, centerLon } = fieldLines;
        const lat = d.coordinates[1];
        const lon = d.coordinates[0];

        // Convert to local polar coordinates relative to center
        const dLat = lat - centerLat;
        const dLon = lon - centerLon;
        const r = Math.sqrt(dLat * dLat + dLon * dLon);
        const theta = Math.atan2(dLon, dLat); // Angle from North (Lat axis)

        // Dipole field line equation: r = L * sin^2(theta)
        // Solve for L (shell parameter) passing through current point
        // Avoid division by zero
        const sinTheta = Math.sin(theta);
        if (Math.abs(sinTheta) < 0.01) {
            setActiveFieldLine([]);
            return;
        }

        const L = r / (sinTheta * sinTheta);

        // Generate the full line for this L
        const line: [number, number][] = [];
        // We want the loop to pass through the point. 
        // The loop goes from theta = 0 to PI (or -PI to PI depending on orientation)
        // Let's generate the loop that corresponds to this L

        // We need to respect the quadrant/sign of L to keep it smooth? 
        // Actually L is always positive if we define theta correctly relative to the axis.
        // Let's assume the axis is the one passing through the center and perpendicular to the dipole?
        // Wait, standard dipole lines are r = L sin^2(theta) where theta is angle from dipole axis.
        // Let's assume dipole axis is East-West for visual variety or North-South?
        // Let's try to match the static lines logic roughly or just make it look "dipole-like" relative to the center.

        // Let's assume dipole axis is vertical (North-South). Theta is angle from North.
        // Then r = L * sin^2(theta).

        // However, we want the line to pass through (dLat, dLon).
        // Let's recalculate theta relative to North.
        // theta = atan2(dLon, dLat). 
        // If dLat is axis, then theta is angle from axis.

        const steps = 50;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI; // 0 to PI
            const r_t = L * Math.sin(t) * Math.sin(t);

            // Convert back to lat/lon
            // We need to rotate this loop to match the plane? 
            // In 2D lat/lon, we just plot it.
            // But we need to know which "lobe" we are in.
            // If we are on the right (dLon > 0), we want the right lobe.
            // If dLon < 0, we want the left lobe?
            // sin^2 is always positive, so r_t is positive.
            // We need to project it correctly.

            // Let's assume the standard form in polar:
            // x = r * sin(t)
            // y = r * cos(t)
            // But here t is the parameter of the curve? No, t IS the angle theta.

            const localLat = r_t * Math.cos(t);
            const localLon = r_t * Math.sin(t);

            // If our point had negative Lon, we might need to mirror?
            // Actually sin(t) goes 0 -> 1 -> 0 for t in 0..PI.
            // So this generates a lobe on the positive Lon side (East).
            // If our point is West, we should flip Lon.

            const finalLon = (dLon < 0) ? -localLon : localLon;

            line.push([centerLat + localLat, centerLon + finalLon]);
        }

        setActiveFieldLine(line);
    };

    // Fetch OSM buildings
    useEffect(() => {
        if (!viewState.latitude || !viewState.longitude) return;

        const fetchBuildings = async () => {
            const query = `
                [out:json];
                (
                  way["building"](around:500,${viewState.latitude},${viewState.longitude});
                );
                out body;
                >;
                out skel qt;
            `;
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

            try {
                const response = await fetch(url);
                const json = await response.json();

                // Process ways into polygons
                const nodes: Record<number, [number, number]> = {};
                json.elements.filter((e: any) => e.type === 'node').forEach((e: any) => {
                    nodes[e.id] = [e.lat, e.lon];
                });

                const polys = json.elements
                    .filter((e: any) => e.type === 'way')
                    .map((way: any) => {
                        return way.nodes.map((nodeId: number) => nodes[nodeId]).filter(Boolean);
                    });

                setBuildings(polys);
            } catch (e) {
                console.error("Error fetching buildings:", e);
            }
        };

        fetchBuildings();
    }, [viewState.latitude, viewState.longitude]);

    // Color scale logic
    const minMag = data.length > 0 ? Math.min(...data.map(d => d.magnitude)) : 0;
    const maxMag = data.length > 0 ? Math.max(...data.map(d => d.magnitude)) : 1;

    const getColor = (mag: number): string => {
        // Logarithmic scale to handle 1/r^3 drop-off
        // Avoid log(0) by adding a small epsilon if needed, but minMag should be > 0 usually.
        // If minMag is 0, treat as 0.1 for log.
        const safeMin = Math.max(minMag, 0.1);
        const safeMax = Math.max(maxMag, safeMin + 0.1);
        const safeMag = Math.max(mag, safeMin);

        const logMin = Math.log(safeMin);
        const logMax = Math.log(safeMax);

        let t = (Math.log(safeMag) - logMin) / (logMax - logMin);
        if (isNaN(t)) t = 0;
        t = Math.max(0, Math.min(1, t)); // Clamp

        // HSL: Blue (240) -> Cyan (180) -> Green (120) -> Yellow (60) -> Red (0)
        const hue = 240 * (1 - t);
        return `hsl(${hue}, 100%, 50%)`;
    };

    return (
        <MapContainer
            center={[viewState.latitude, viewState.longitude]}
            zoom={20} // Deep zoom
            maxZoom={22}
            style={{ width: '100%', height: '100%', background: '#1a1a1a' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                maxZoom={22}
            />

            <RecenterMap
                lat={viewState.latitude}
                lon={viewState.longitude}
                zoom={20}
            />

            {/* Buildings */}
            {buildings.map((poly, i) => (
                <Polygon
                    key={i}
                    positions={poly}
                    pathOptions={{ color: '#555', weight: 1, fillOpacity: 0.3, fillColor: '#777' }}
                />
            ))}

            {/* Static Theoretical Field Lines */}
            {fieldLines.lines.map((line, i) => (
                <Polyline
                    key={`line-${i}`}
                    positions={line}
                    pathOptions={{
                        color: 'rgba(255, 255, 255, 0.1)',
                        weight: 1,
                        dashArray: '5, 10'
                    }}
                />
            ))}

            {/* Dynamic Active Field Line */}
            {activeFieldLine.length > 0 && (
                <Polyline
                    positions={activeFieldLine}
                    pathOptions={{
                        color: '#00ffff', // Cyan glow
                        weight: 3,
                        opacity: 0.8,
                        dashArray: '10, 5'
                    }}
                />
            )}

            {/* Theoretical Trajectory (Red Dotted) */}
            {theoreticalPath.length > 0 && (
                <Polyline
                    positions={theoreticalPath}
                    pathOptions={{
                        color: 'red',
                        weight: 2,
                        dashArray: '5, 10',
                        opacity: 0.7
                    }}
                />
            )}

            {/* Data Points */}
            {data.map((d, i) => (
                <CircleMarker
                    key={i}
                    center={[d.coordinates[1], d.coordinates[0]]}
                    radius={6}
                    pathOptions={{
                        fillColor: getColor(d.magnitude),
                        color: 'white',
                        weight: 0.5,
                        opacity: 0.8,
                        fillOpacity: 0.9
                    }}
                    eventHandlers={{
                        mouseover: (e) => handleHover(d, e),
                        mouseout: () => {
                            setHoverInfo(null);
                            setActiveFieldLine([]);
                        }
                    }}
                >
                    <Popup>
                        <div>
                            <strong>Magnitude :</strong> {d.magnitude.toFixed(2)} µT<br />
                            <strong>Temps :</strong> {d.time}
                        </div>
                    </Popup>
                </CircleMarker>
            ))}

            <Legend min={minMag} max={maxMag} />
        </MapContainer>
    );
}
