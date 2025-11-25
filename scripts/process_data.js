const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DATA_DIR = path.join(__dirname, '../data/extracted');
const OUTPUT_FILE = path.join(__dirname, '../data/data.geojson');

const locationData = [];
const magnetometerData = [];

// Helper to calculate distance between two GPS points (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function processData() {
    console.log('Reading Location.csv...');
    fs.createReadStream(path.join(DATA_DIR, 'Location.csv'))
        .pipe(csv())
        .on('data', (row) => {
            locationData.push({
                time: BigInt(row.time), // Nanoseconds
                lat: parseFloat(row.latitude),
                lon: parseFloat(row.longitude),
                alt: parseFloat(row.altitude),
                speed: parseFloat(row.speed),
                bearing: parseFloat(row.bearing)
            });
        })
        .on('end', () => {
            console.log(`Loaded ${locationData.length} location points.`);
            readMagnetometer();
        });
}

function readMagnetometer() {
    console.log('Reading Magnetometer.csv...');
    fs.createReadStream(path.join(DATA_DIR, 'Magnetometer.csv'))
        .pipe(csv())
        .on('data', (row) => {
            magnetometerData.push({
                time: BigInt(row.time),
                x: parseFloat(row.x),
                y: parseFloat(row.y),
                z: parseFloat(row.z)
            });
        })
        .on('end', () => {
            console.log(`Loaded ${magnetometerData.length} magnetometer points.`);
            interpolateAndGenerateGeoJSON();
        });
}

function interpolateAndGenerateGeoJSON() {
    console.log('Interpolating and generating GeoJSON...');
    
    // Sort data by time just in case
    locationData.sort((a, b) => (a.time < b.time ? -1 : 1));
    magnetometerData.sort((a, b) => (a.time < b.time ? -1 : 1));

    const features = [];
    let locIndex = 0;

    for (const mag of magnetometerData) {
        // Find the location points surrounding this magnetometer reading
        while (locIndex < locationData.length - 1 && locationData[locIndex + 1].time < mag.time) {
            locIndex++;
        }

        if (locIndex >= locationData.length - 1) break; // End of location data

        const loc1 = locationData[locIndex];
        const loc2 = locationData[locIndex + 1];

        // Linear interpolation factor
        const t1 = Number(loc1.time);
        const t2 = Number(loc2.time);
        const tMag = Number(mag.time);
        
        if (tMag < t1) continue; // Should not happen if sorted and loop logic is correct

        const ratio = (tMag - t1) / (t2 - t1);

        const lat = loc1.lat + (loc2.lat - loc1.lat) * ratio;
        const lon = loc1.lon + (loc2.lon - loc1.lon) * ratio;
        const alt = loc1.alt + (loc2.alt - loc1.alt) * ratio;

        const magnitude = Math.sqrt(mag.x * mag.x + mag.y * mag.y + mag.z * mag.z);

        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [lon, lat, alt]
            },
            properties: {
                time: tMag,
                mag_x: mag.x,
                mag_y: mag.y,
                mag_z: mag.z,
                magnitude: magnitude
            }
        });
    }

    const geoJSON = {
        type: 'FeatureCollection',
        features: features
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geoJSON, null, 2));
    console.log(`GeoJSON written to ${OUTPUT_FILE} with ${features.length} points.`);
}

processData();
