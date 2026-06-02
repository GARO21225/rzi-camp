// Tests setup — mocks globaux (sans JSX pour rester .js valide)
import { vi } from 'vitest'
import React from 'react'

// Mock leaflet (utilisé dans DigitalTwin)
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => React.createElement('div', { 'data-testid': 'map' }, children),
  TileLayer: () => null,
  CircleMarker: ({ children }) => React.createElement('div', { 'data-testid': 'marker' }, children),
  Popup: ({ children }) => React.createElement('div', null, children),
  ZoomControl: () => null,
}))

vi.mock('leaflet', () => ({
  Map: vi.fn(),
  TileLayer: vi.fn(),
  CircleMarker: vi.fn(),
  Popup: vi.fn(),
}))

// Mock matchMedia
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

// Mock localStorage
const ls = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: ls, writable: true })

// Mock fetch global
global.fetch = vi.fn()
