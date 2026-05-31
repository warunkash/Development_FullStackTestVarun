import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const statusColors: Record<string, string> = {
  active: '#22c55e',
  maintenance: '#f59e0b',
  inactive: '#6b7280',
  faulted: '#ef4444',
};

function createStationIcon(status: string) {
  const color = statusColors[status] ?? '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -16],
  });
}

export interface MapStation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  availableChargers: number;
  totalChargers: number;
}

interface StationsMapProps {
  stations: MapStation[];
  height?: string;
  center?: [number, number];
  zoom?: number;
  onStationClick?: (station: MapStation) => void;
}

export function StationsMap({
  stations,
  height = '384px',
  center = [17.5, 79.0],
  zoom = 7,
  onStationClick,
}: StationsMapProps) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height, width: '100%', borderRadius: '12px' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {stations.map((station) => (
        <Marker
          key={station.id}
          position={[station.latitude, station.longitude]}
          icon={createStationIcon(station.status)}
          eventHandlers={{ click: () => onStationClick?.(station) }}
        >
          <Popup>
            <div className="p-1 min-w-[140px]">
              <p className="font-bold text-sm">{station.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{station.address}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: statusColors[station.status] ?? '#6b7280' }} />
                <span className="text-xs capitalize">{station.status}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {station.availableChargers}/{station.totalChargers} chargers available
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
