// hex = pastel (guardado en materias.color); strong = tono fuerte para fondos sólidos con texto blanco.
export const PALETTE: readonly { name: string; hex: string; strong: string }[] = [
  { name: 'Rojo', hex: '#f4a3a3', strong: '#c62f2f' },
  { name: 'Naranja', hex: '#f5bf93', strong: '#b4571a' },
  { name: 'Ámbar', hex: '#f0d27a', strong: '#8f6200' },
  { name: 'Lima', hex: '#c5de8a', strong: '#587a10' },
  { name: 'Verde', hex: '#93dcbf', strong: '#17805a' },
  { name: 'Turquesa', hex: '#8edbd3', strong: '#0e7a6e' },
  { name: 'Celeste', hex: '#8fd3f0', strong: '#0a76a3' },
  { name: 'Azul', hex: '#9fc3f7', strong: '#2f6fd6' },
  { name: 'Violeta', hex: '#c7b6f5', strong: '#6a4bd6' },
  { name: 'Rosa', hex: '#f2a7ba', strong: '#c43a62' },
  { name: 'Marrón', hex: '#dbb89e', strong: '#8a5232' },
  { name: 'Gris', hex: '#b6bcc8', strong: '#5f6676' },
];

export const NEUTRAL = { hex: '#b6bcc8', strong: '#5f6676' };

export const strongOf = (hex: string): string => PALETTE.find((p) => p.hex === hex)?.strong ?? NEUTRAL.strong;
