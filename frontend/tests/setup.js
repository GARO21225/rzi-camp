import { vi } from 'vitest'
import React from 'react'

// Mock react-leaflet (utilisé dans MapPage.jsx)
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => React.createElement('div', { 'data-testid': 'map' }, children),
  TileLayer: () => null,
  GeoJSON: () => null,
  Marker: () => null,
  Polyline: () => null,
  Popup: ({ children }) => React.createElement('div', null, children),
  Circle: () => null,
  useMap: () => ({ flyTo: () => {}, on: () => {}, off: () => {} }),
  useMapEvents: () => ({}),
}))

vi.mock('leaflet', () => ({
  Map: vi.fn(),
  TileLayer: vi.fn(),
  GeoJSON: vi.fn(),
  Marker: vi.fn(),
  icon: vi.fn(),
  divIcon: vi.fn(),
  latLngBounds: vi.fn(),
}))

// Mock recharts (utilisé dans Dashboard.jsx)
vi.mock('recharts', () => ({
  BarChart: ({ children }) => React.createElement('div', null, children),
  Bar: () => null,
  PieChart: ({ children }) => React.createElement('div', null, children),
  Pie: () => null,
  Cell: () => null,
  ResponsiveContainer: ({ children }) => React.createElement('div', null, children),
  Tooltip: () => null,
  LineChart: ({ children }) => React.createElement('div', null, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Legend: () => null,
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const ls = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: ls, writable: true })

global.fetch = vi.fn()
