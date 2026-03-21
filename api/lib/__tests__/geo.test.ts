import { describe, it, expect } from 'vitest'
import { haversineMeters, bboxFromCoords, interpolateLine, bboxIntersects } from '../geo.js'

describe('haversineMeters', () => {
  it('same point → 0', () => {
    expect(haversineMeters({ lat: 10.776, lng: 106.7 }, { lat: 10.776, lng: 106.7 })).toBe(0)
  })

  it('1 degree latitude ≈ 111 km', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(112_000)
  })

  it('HCMC center → Bình Thạnh ≈ 2.8–3.2 km', () => {
    const d = haversineMeters({ lat: 10.7769, lng: 106.7009 }, { lat: 10.8032, lng: 106.7078 })
    expect(d).toBeGreaterThan(2_800)
    expect(d).toBeLessThan(3_200)
  })

  it('antipodal (0,0) → (0,180) ≈ half earth circumference', () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })
    expect(d).toBeGreaterThan(20_000_000)
    expect(d).toBeLessThan(20_100_000)
  })

  it('symmetric: a→b === b→a', () => {
    const a = { lat: 10.5, lng: 106.5 }
    const b = { lat: 11.0, lng: 107.0 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 0)
  })
})

describe('bboxFromCoords', () => {
  it('single point: all four edges equal the point', () => {
    expect(bboxFromCoords([{ lat: 10.5, lng: 106.5 }])).toEqual({
      north: 10.5, south: 10.5, east: 106.5, west: 106.5,
    })
  })

  it('two diagonal points: correct min/max', () => {
    const result = bboxFromCoords([{ lat: 10.0, lng: 106.0 }, { lat: 11.0, lng: 107.0 }])
    expect(result).toEqual({ north: 11.0, south: 10.0, east: 107.0, west: 106.0 })
  })

  it('three points: picks correct extremes', () => {
    const result = bboxFromCoords([
      { lat: 10.0, lng: 106.0 },
      { lat: 10.5, lng: 107.5 },
      { lat: 11.0, lng: 106.5 },
    ])
    expect(result).toEqual({ north: 11.0, south: 10.0, east: 107.5, west: 106.0 })
  })

  it('points on same latitude: north === south', () => {
    const result = bboxFromCoords([
      { lat: 10.5, lng: 106.0 },
      { lat: 10.5, lng: 107.0 },
    ])
    expect(result.north).toBe(10.5)
    expect(result.south).toBe(10.5)
    expect(result.west).toBe(106.0)
    expect(result.east).toBe(107.0)
  })
})

describe('interpolateLine', () => {
  it('n=0 clamps to 2 (origin + dest)', () => {
    const pts = interpolateLine({ lat: 0, lng: 0 }, { lat: 2, lng: 2 }, 0)
    expect(pts).toHaveLength(2)
    expect(pts[0]).toEqual({ lat: 0, lng: 0 })
    expect(pts[1]).toEqual({ lat: 2, lng: 2 })
  })

  it('n=1 clamps to 2', () => {
    const pts = interpolateLine({ lat: 0, lng: 0 }, { lat: 2, lng: 2 }, 1)
    expect(pts).toHaveLength(2)
  })

  it('n=3: origin, midpoint, dest', () => {
    const pts = interpolateLine({ lat: 0, lng: 0 }, { lat: 2, lng: 4 }, 3)
    expect(pts).toHaveLength(3)
    expect(pts[0]).toEqual({ lat: 0, lng: 0 })
    expect(pts[1]).toEqual({ lat: 1, lng: 2 })
    expect(pts[2]).toEqual({ lat: 2, lng: 4 })
  })

  it('first is always origin, last is always dest', () => {
    const a = { lat: 10.5, lng: 106.0 }
    const b = { lat: 11.0, lng: 107.0 }
    const pts = interpolateLine(a, b, 10)
    expect(pts[0]).toEqual(a)
    expect(pts[9]).toEqual(b)
  })

  it('n=40 returns 40 points', () => {
    const pts = interpolateLine({ lat: 10.7, lng: 106.7 }, { lat: 10.8, lng: 106.8 }, 40)
    expect(pts).toHaveLength(40)
  })
})

describe('bboxIntersects', () => {
  const box = { north: 2, south: 0, east: 2, west: 0 }

  it('fully overlapping boxes → true', () => {
    expect(bboxIntersects(box, { north: 3, south: 1, east: 3, west: 1 })).toBe(true)
  })

  it('b is east of a (no overlap) → false', () => {
    expect(bboxIntersects(box, { north: 2, south: 0, east: 5, west: 3 })).toBe(false)
  })

  it('b is north of a (no overlap) → false', () => {
    expect(bboxIntersects(box, { north: 5, south: 3, east: 2, west: 0 })).toBe(false)
  })

  it('b is west of a (no overlap) → false', () => {
    expect(bboxIntersects(box, { north: 2, south: 0, east: -1, west: -3 })).toBe(false)
  })

  it('b is south of a (no overlap) → false', () => {
    expect(bboxIntersects(box, { north: -1, south: -3, east: 2, west: 0 })).toBe(false)
  })

  it('touching east edge (a.east=b.west=2) → true (strict < means touching passes)', () => {
    expect(bboxIntersects(box, { north: 2, south: 0, east: 4, west: 2 })).toBe(true)
  })

  it('touching north edge → true', () => {
    expect(bboxIntersects(box, { north: 4, south: 2, east: 2, west: 0 })).toBe(true)
  })

  it('b fully contained within a → true', () => {
    expect(bboxIntersects(box, { north: 1.5, south: 0.5, east: 1.5, west: 0.5 })).toBe(true)
  })

  it('identical boxes → true', () => {
    expect(bboxIntersects(box, { ...box })).toBe(true)
  })
})
