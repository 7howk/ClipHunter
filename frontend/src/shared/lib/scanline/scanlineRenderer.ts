/**
 * WebGL-рендерер «сканлайнов»: берёт кадр источника (canvas или video) и рисует
 * его горизонтальными чёрными линиями. Толщина линии = темнота пикселя, очень
 * тёмные участки сливаются в сплошные блоки, плюс еле заметный «призрак»
 * исходного изображения между строками.
 */

const VERTEX = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_source;
uniform vec2 u_resolution; // размер холста в пикселях устройства
uniform vec2 u_extent;     // размер сетки источника в пикселях устройства
uniform float u_row;       // высота строки, целое чётное число пикселей
uniform vec3 u_ink;

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float lum(vec2 uv) {
  vec3 c = texture2D(u_source, uv).rgb;
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Гладкий шум: соседние куски и строки получают близкие значения, поэтому
// разрывы собираются в читаемые группы, а не рассыпаются по строке
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(vec3(i, 17.0));
  float b = hash(vec3(i + vec2(1.0, 0.0), 17.0));
  float c = hash(vec3(i + vec2(0.0, 1.0), 17.0));
  float d = hash(vec3(i + vec2(1.0, 1.0), 17.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float row = floor(frag.y / u_row);
  float column = u_row * 0.5;
  float cell = floor(frag.x / column);

  // Один отсчёт на ячейку: по горизонтали ровно в центре текселя источника,
  // по вертикали на границе двух текселей (среднее). Фаза у всех ячеек
  // одинакова, поэтому линии не дрожат и не дают муар
  vec2 centre = vec2((cell + 0.5) * column, (row + 0.5) * u_row);
  float dark = 1.0 - lum(centre / u_extent);

  // Тон по соседним ячейкам: границы форм собираются в группы строк
  vec2 dx = vec2(column, 0.0);
  vec2 dy = vec2(0.0, column);
  float around =
    (lum((centre + dx) / u_extent) + lum((centre - dx) / u_extent) +
     lum((centre + dy) / u_extent) + lum((centre - dy) / u_extent)) * 0.25;
  float smoothDark = mix(dark, 1.0 - around, 0.5);

  // Светлое пусто, тёмное — сплошной блок, строки только в полутонах.
  // Доля закрашенных кусков растёт с тоном; толщина строк одинаковая
  float coverage = smoothstep(0.27, 0.62, smoothDark);
  float grain = smoothstep(0.2, 0.8, valueNoise(vec2(frag.x / (column * 8.0), row / 3.0)));
  bool lit = coverage > grain;
  bool solid = dark > 0.7;

  float y = floor(mod(frag.y, u_row));
  float thickness = floor(u_row * 0.45 + 0.5);
  float start = floor((u_row - thickness) * 0.5);
  bool inLine = y >= start && y < start + thickness;

  float ink = (solid || (lit && inLine)) ? 1.0 : 0.0;

  float ghost = (1.0 - lum(frag / u_extent)) * 0.12;
  float alpha = max(ink, ghost);

  gl_FragColor = vec4(u_ink * alpha, alpha);
}`;

/**
 * Сетка источника: один тексель на ячейку (ширина ячейки — половина строки).
 * Источник такого размера шейдер читает без интерполяции фаз.
 */
export function getScanlineGrid(width: number, height: number, rowPx: number) {
  const cell = rowPx / 2;
  return {
    width: Math.max(1, Math.ceil(width / cell)),
    height: Math.max(1, Math.ceil(height / cell)),
  };
}

/** Высота строки в пикселях устройства: целое чётное число, около 6 CSS px. */
export function getRowPx(dpr: number, rowCssPx = 6) {
  return Math.max(2, 2 * Math.round((rowCssPx / 2) * dpr));
}

export interface ScanlineRenderer {
  /** Перерисовать: загрузить текущий кадр источника в текстуру. */
  render(source: TexImageSource): void;
  resize(width: number, height: number, rowPx: number): void;
  destroy(): void;
}

export interface ScanlineRendererOptions {
  ink?: [number, number, number];
  /** Контекст восстановлен и ресурсы пересозданы: кадр нужно нарисовать заново. */
  onRestored?: () => void;
  /** WebGL больше не работает (контекст не вернулся): нужен запасной вариант. */
  onFatal?: () => void;
}

/** Ждём возврата контекста не дольше этого, потом считаем WebGL потерянным. */
const RESTORE_TIMEOUT_MS = 1500;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Не удалось создать шейдер');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Ошибка компиляции шейдера: ${log ?? ''}`);
  }
  return shader;
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!program) throw new Error('Не удалось создать программу');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // После линковки шейдеры программе не нужны
  gl.detachShader(program, vertex);
  gl.detachShader(program, fragment);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error('Не удалось слинковать программу');
  }
  return program;
}

/**
 * Проверяет шейдеры на отдельном временном холсте: контекст основного холста
 * захватывается, только если WebGL точно заработает. Иначе на нём нельзя было
 * бы получить 2D-контекст для запасного варианта.
 */
function isWebglUsable(): boolean {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl');
  if (!gl) return false;
  try {
    gl.deleteProgram(buildProgram(gl));
    return true;
  } catch {
    return false;
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** null, если WebGL недоступен — холст остаётся чистым для 2D-запасного варианта. */
export function createScanlineRenderer(
  canvas: HTMLCanvasElement,
  { ink = [0.07, 0.07, 0.07], onRestored, onFatal }: ScanlineRendererOptions = {},
): ScanlineRenderer | null {
  if (!isWebglUsable()) return null;
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
  });
  if (!gl) return null;

  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let uResolution: WebGLUniformLocation | null = null;
  let uExtent: WebGLUniformLocation | null = null;
  let uRow: WebGLUniformLocation | null = null;
  let lost = false;
  let restoreTimer = 0;
  let size: { width: number; height: number; rowPx: number } | null = null;

  const applySize = () => {
    if (!size) return;
    const { width, height, rowPx } = size;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uResolution, width, height);
    gl.uniform1f(uRow, rowPx);
    const grid = getScanlineGrid(width, height, rowPx);
    gl.uniform2f(uExtent, (grid.width * rowPx) / 2, (grid.height * rowPx) / 2);
  };

  const init = () => {
    program = buildProgram(gl);
    gl.useProgram(program);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    uResolution = gl.getUniformLocation(program, 'u_resolution');
    uExtent = gl.getUniformLocation(program, 'u_extent');
    uRow = gl.getUniformLocation(program, 'u_row');
    gl.uniform3f(gl.getUniformLocation(program, 'u_ink'), ...ink);
    applySize();
  };

  const release = () => {
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    texture = buffer = program = null;
  };

  const onLost = (event: Event) => {
    // Без preventDefault браузер не станет восстанавливать контекст
    event.preventDefault();
    lost = true;
    window.clearTimeout(restoreTimer);
    restoreTimer = window.setTimeout(() => onFatal?.(), RESTORE_TIMEOUT_MS);
  };
  const onContextRestored = () => {
    window.clearTimeout(restoreTimer);
    try {
      init();
    } catch {
      onFatal?.();
      return;
    }
    lost = false;
    onRestored?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  try {
    init();
  } catch {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    release();
    // Холст уже захвачен WebGL: для 2D вызывающему коду нужен новый холст
    return null;
  }

  return {
    resize(width, height, rowPx) {
      canvas.width = width;
      canvas.height = height;
      size = { width, height, rowPx };
      if (!lost) applySize();
    },
    render(source) {
      if (lost || gl.isContextLost()) return;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      window.clearTimeout(restoreTimer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      release();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
