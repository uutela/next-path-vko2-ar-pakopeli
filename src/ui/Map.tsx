import { Camera, Map as MapLibreMap, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { MAP_ATTRIBUTION, MAP_STYLE_URL, MAP_ZOOM, initialCentre } from '../config/map';
import type { Coordinates, EscapePoint } from '../domain/types';

export interface MapProps {
  points: EscapePoint[];
  /** The player's last known position, once there is one. */
  player?: Coordinates;
}

/** Native map. The web build resolves Map.web.tsx instead. */
export function Map({ points, player }: MapProps) {
  return (
    <View style={styles.container}>
      {/* Keyed on whether a position is known, not on the position itself.
          The camera below is an *initial* state, read once at mount, so a
          position arriving later cannot move a map that is already open —
          undefined to known flips once and re-mounts once. Later movement
          deliberately does not re-centre: a map that jumps back every few
          metres cannot be panned. See map-view.md AC18. */}
      <MapLibreMap
        key={player ? 'player' : 'points'}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        attribution={false}
      >
        {/* Without this the map opened wherever MapLibre chose, and a point
            anywhere else was off screen. See map-view.md AC14. */}
        <Camera initialViewState={{ center: initialCentre(points, player), zoom: MAP_ZOOM }} />
        {points.map((point) => (
          <Marker
            key={point.id}
            lngLat={[point.coordinates.longitude, point.coordinates.latitude]}
          >
            <View style={styles.marker} />
          </Marker>
        ))}
      </MapLibreMap>
      <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#c2410c',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  attribution: {
    fontSize: 11,
    opacity: 0.8,
    color: '#1a1a1a',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
