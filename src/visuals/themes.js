/**
 * Color Themes for Recursive Garden
 * 
 * Four calm palettes: Dusk, Moss, Moonlight, Ember.
 * Each theme defines colors for every visual layer.
 */

export const THEMES = {
  Dusk: {
    name: 'Dusk',
    sky: {
      top: '#0d0b1e',
      mid: '#2a1f4e',
      bottom: '#4a3060',
      horizon: '#8b5a6b'
    },
    tree: {
      trunk: '#5a4a3a',
      branch: '#7a6a5a',
      glow: '#f0c878',
      leaf: '#a8c878',
      blossom: '#f0a0b0'
    },
    hanoi: {
      pillar: '#6050a0',
      disc: ['#f0a060', '#e08070', '#d060a0', '#a060d0', '#6080e0', '#60c0a0'],
      ripple: 'rgba(240, 160, 96, 0.3)'
    },
    firefly: {
      glow: '#ffe8a0',
      trail: 'rgba(255, 232, 160, 0.3)',
      polygon: 'rgba(255, 232, 160, 0.15)'
    },
    stars: '#ffffff',
    mist: 'rgba(180, 160, 200, 0.03)',
    ground: '#1a1520',
    text: '#c0b0d0',
    accent: '#f0a060'
  },

  Moss: {
    name: 'Moss',
    sky: {
      top: '#0a1a10',
      mid: '#1a3a28',
      bottom: '#2a4a3a',
      horizon: '#4a6a5a'
    },
    tree: {
      trunk: '#3a3020',
      branch: '#5a4a30',
      glow: '#a0d890',
      leaf: '#70b060',
      blossom: '#90d0a0'
    },
    hanoi: {
      pillar: '#406050',
      disc: ['#a0d890', '#80c070', '#60a860', '#40a080', '#3090a0', '#5080a0'],
      ripple: 'rgba(160, 216, 144, 0.3)'
    },
    firefly: {
      glow: '#c0f0a0',
      trail: 'rgba(192, 240, 160, 0.3)',
      polygon: 'rgba(192, 240, 160, 0.15)'
    },
    stars: '#d0e8d0',
    mist: 'rgba(100, 160, 120, 0.03)',
    ground: '#0a1810',
    text: '#90b090',
    accent: '#a0d890'
  },

  Moonlight: {
    name: 'Moonlight',
    sky: {
      top: '#050a18',
      mid: '#101830',
      bottom: '#1a2848',
      horizon: '#304068'
    },
    tree: {
      trunk: '#3a4050',
      branch: '#4a5a70',
      glow: '#a0c8f0',
      leaf: '#7898c0',
      blossom: '#b0c8e0'
    },
    hanoi: {
      pillar: '#4060a0',
      disc: ['#a0c8f0', '#80a8d0', '#6088b0', '#5078a0', '#406890', '#305880'],
      ripple: 'rgba(160, 200, 240, 0.3)'
    },
    firefly: {
      glow: '#c0d8f0',
      trail: 'rgba(192, 216, 240, 0.3)',
      polygon: 'rgba(192, 216, 240, 0.15)'
    },
    stars: '#e0e8f0',
    mist: 'rgba(100, 130, 180, 0.03)',
    ground: '#0a1020',
    text: '#8090b0',
    accent: '#a0c8f0'
  },

  Ember: {
    name: 'Ember',
    sky: {
      top: '#100808',
      mid: '#2a1210',
      bottom: '#3a1a18',
      horizon: '#5a2a20'
    },
    tree: {
      trunk: '#4a3028',
      branch: '#6a4038',
      glow: '#f08050',
      leaf: '#c06840',
      blossom: '#f0a060'
    },
    hanoi: {
      pillar: '#804030',
      disc: ['#f08050', '#e06040', '#d04830', '#c03828', '#a02820', '#803020'],
      ripple: 'rgba(240, 128, 80, 0.3)'
    },
    firefly: {
      glow: '#ffa060',
      trail: 'rgba(255, 160, 96, 0.3)',
      polygon: 'rgba(255, 160, 96, 0.15)'
    },
    stars: '#f0d0c0',
    mist: 'rgba(180, 100, 80, 0.03)',
    ground: '#180a08',
    text: '#c09080',
    accent: '#f08050'
  }
};

export function getTheme(name) {
  return THEMES[name] || THEMES.Dusk;
}
