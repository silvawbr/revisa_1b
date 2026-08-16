function spatialSvg(content) {
  return `<svg class="spatial-svg" viewBox="0 0 160 150" aria-hidden="true" focusable="false">${content}</svg>`;
}

function renderCube(representation) {
  const dots = representation === 'object'
    ? '<circle class="cube-dot" cx="51" cy="76" r="6"/><circle class="cube-dot" cx="73" cy="76" r="6"/>'
    : '';

  return spatialSvg(`<g stroke-linejoin="round">
    <polygon class="cube-top" points="27,44 65,27 129,27 92,44"/>
    <polygon class="cube-side" points="92,44 129,27 129,95 92,112"/>
    <polygon class="cube-front" points="27,44 92,44 92,112 27,112"/>
    ${dots}
  </g>`);
}

function renderRectangularBlock(representation) {
  const detail = representation === 'object'
    ? '<path class="block-seam" d="M46 45 L46 53"/>'
    : '';

  return spatialSvg(`<g stroke-linejoin="round">
    <polygon class="block-top" points="18,56 44,43 142,43 116,56"/>
    <polygon class="block-side" points="116,56 142,43 142,91 116,105"/>
    <polygon class="block-front" points="18,56 116,56 116,105 18,105"/>
    ${detail}
  </g>`);
}

function renderCylinder(representation) {
  const detail = representation === 'object'
    ? '<path class="cylinder-mark" d="M80 66 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z"/>'
    : '';

  return spatialSvg(`<g stroke-linejoin="round">
    <path class="cylinder-body" d="M35 40 V107 C35 116 125 116 125 107 V40 Z"/>
    <ellipse class="cylinder-top" cx="80" cy="40" rx="45" ry="14"/>
    <path class="cylinder-bottom" d="M35 107 C35 116 125 116 125 107"/>
    ${detail}
  </g>`);
}

function renderCone(representation) {
  const detail = representation === 'object'
    ? '<circle class="cone-pom" cx="80" cy="18" r="8"/>'
    : '';

  return spatialSvg(`<g stroke-linejoin="round">
    ${detail}
    <path class="cone-body" d="M80 25 L130 108 L30 108 Z"/>
    <ellipse class="cone-base" cx="80" cy="108" rx="50" ry="14"/>
  </g>`);
}

function renderSphere() {
  return spatialSvg(`<defs>
    <radialGradient id="sphere-gradient" cx="35%" cy="28%" r="72%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.14" stop-color="#f2edff"/>
      <stop offset="0.45" stop-color="#d5c7f7"/>
      <stop offset="1" stop-color="#a995dc"/>
    </radialGradient>
  </defs>
  <circle class="sphere-body" cx="80" cy="75" r="55"/>
  <circle class="sphere-highlight" cx="62" cy="55" r="8"/>`);
}

export function renderSpatialSvg(shapeKey, representation = 'solid') {
  switch (shapeKey) {
    case 'cube':
      return renderCube(representation);
    case 'rectangular-block':
      return renderRectangularBlock(representation);
    case 'cylinder':
      return renderCylinder(representation);
    case 'cone':
      return renderCone(representation);
    case 'sphere':
      return renderSphere();
    default:
      throw new RangeError(`Forma espacial desconhecida: ${shapeKey}`);
  }
}
