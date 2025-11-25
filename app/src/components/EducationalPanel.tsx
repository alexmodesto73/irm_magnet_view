import type { DataPoint } from '../utils/dataLoader';

interface EducationalPanelProps {
    hoverInfo: { object: DataPoint } | null;
}

export default function EducationalPanel({ hoverInfo }: EducationalPanelProps) {
    const magnitude = hoverInfo?.object?.magnitude || 0;

    // Physics calculations
    // Gyromagnetic ratio for Hydrogen (MHz/T)
    const GAMMA = 42.58;
    // Larmor frequency in MHz
    const larmorFreq = (GAMMA * (magnitude / 1000000)).toFixed(4); // magnitude is in µT, need T

    // Safety context
    const getSafetyMessage = (mag: number) => {
        if (mag < 100) return "Zone sûre. Comparable au champ magnétique terrestre (env. 50 µT).";
        if (mag < 500) return "Zone de prudence. Les appareils électroniques peuvent être affectés.";
        if (mag < 3000) return "Zone de danger ! Forte attraction des objets ferromagnétiques. Risque de projectile.";
        return "DANGER CRITIQUE. Champ magnétique extrême. Ne pas entrer avec du métal.";
    };

    // Physics explanation
    const getPhysicsContext = (mag: number) => {
        if (mag === 0) return "Survolez la carte pour voir les données physiques.";
        return (
            <>
                <p><strong>Fréquence de Larmor :</strong> {larmorFreq} Hz</p>
                <p>À cette intensité, les protons d'hydrogène de votre corps précessent à cette fréquence.</p>
                <p><strong>Alignement des Spins :</strong> Plus le champ est fort ({mag.toFixed(1)} µT), plus les protons s'alignent avec le champ B0, créant l'aimantation nette nécessaire à l'imagerie.</p>
            </>
        );
    };

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            width: '300px',
            background: 'rgba(20, 20, 30, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            zIndex: 1000,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <h2 style={{ marginTop: 0, color: '#4facfe', fontSize: '1.5em' }}>Laboratoire IRM</h2>

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', fontSize: '1em', color: '#ccc' }}>Champ Actuel</h3>
                <div style={{ fontSize: '2.5em', fontWeight: 'bold', color: magnitude > 1000 ? '#ff4b1f' : '#00f260', textShadow: '0 0 10px rgba(0,0,0,0.3)' }}>
                    {magnitude.toFixed(2)} <span style={{ fontSize: '0.4em', opacity: 0.8 }}>µT</span>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', fontSize: '1em', color: '#ccc' }}>État de Sécurité</h3>
                <p style={{ color: magnitude > 500 ? '#ff9a9e' : '#a18cd1', fontWeight: '500' }}>
                    {getSafetyMessage(magnitude)}
                </p>
            </div>

            <div>
                <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', fontSize: '1em', color: '#ccc' }}>Physique Quantique</h3>
                <div style={{ fontSize: '0.9em', lineHeight: '1.5', color: '#eee' }}>
                    {getPhysicsContext(magnitude)}
                </div>
            </div>
        </div>
    );
}
