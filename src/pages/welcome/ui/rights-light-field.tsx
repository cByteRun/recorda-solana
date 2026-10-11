import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Sample the geometry of the existing SVG marks, in canvas-height units.
// Every layout has the same twelve node identities so transitions preserve spheres.
const markPoints = [
  [[20,2], [14,12], [8,23], [2,34], [14,34], [26,34], [38,34], [32,23], [26,12], [20,25], [12,29], [28,29]],
  [[8,4], [17,4], [26,4], [35,4], [5,17], [15,17], [25,17], [35,17], [5,30], [14,30], [23,30], [32,30]],
  [[10,7], [10,16], [10,24], [10,33], [20,7], [27,10], [29,15], [27,20], [21,23], [15,23], [26,28], [32,33]],
];
const layouts = markPoints.map(points => points.map(([x, y]) => [(x - 20) * .008, (19 - y) * .008]));
const nodeCount = layouts[0].length;
const shapes = ['kase', 'solana', 'recorda'];
const palettes = [
  markPoints[0].map(([x, y]) => y >= 25 ? [.2, .75, .46] : x <= 20 ? [.35, .95, .55] : [.72, 1, .5]),
  markPoints[1].map(([, y]) => y < 10 ? [.15, 1, .68] : y < 23 ? [.45, .76, .95] : [.65, .3, 1]),
  markPoints[2].map(([x]) => x < 20 ? [.6, 1, .8] : [.73, .55, 1]),
];

const vertexSource = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

// Screen-space area-light transport with spherical occlusion and soft shadows.
// All twelve spheres can emit; pointer proximity isolates a light as in the video.
const fragmentSource = `precision highp float;
uniform vec2 u_resolution;
uniform float u_focus;
uniform vec2 u_nodes[${nodeCount}];
uniform vec3 u_lights[${nodeCount}];
uniform vec3 u_colors[${nodeCount}];
float visibility(vec2 pixel, vec2 source) {
  vec2 ray = pixel - source;
  float rayLength = length(ray);
  vec2 direction = ray / max(rayLength, 0.0001);
  float result = 1.0;
  for (int j = 0; j < ${nodeCount}; j++) {
    vec2 delta = u_nodes[j] - source;
    float along = dot(delta, direction);
    float perpendicular = abs(delta.x * direction.y - delta.y * direction.x);
    if (along > 0.02 && along < rayLength) {
      float penumbra = 0.002 + along * 0.035;
      result *= smoothstep(0.013 - penumbra, 0.015 + penumbra, perpendicular);
    }
  }
  return result;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
  vec3 light = vec3(0.0);
  for (int i = 0; i < ${nodeCount}; i++) {
    vec2 source = u_lights[i].xy;
    float power = u_lights[i].z;
    float d = length(uv - source);
    float diffuse = exp(-d * 9.0) * (0.055 + 0.13 * u_focus) + exp(-d * 5.0) * 0.035 * u_focus;
    float bloom = exp(-d * 85.0) * 0.33;
    light += u_colors[i] * power * (diffuse * visibility(uv, source) + bloom);
  }
  for (int j = 0; j < ${nodeCount}; j++) {
    vec2 delta = uv - u_nodes[j];
    float d = length(delta);
    // Antialias only the silhouette, within one physical render pixel.
    // The old broad smoothstep blurred the sphere itself into its bloom.
    float radius = 0.014;
    float edge = 0.75 / u_resolution.y;
    if (d > radius + edge) continue;
    float disc = 1.0 - smoothstep(radius - edge, radius + edge, d);
    float curvedEdge = sqrt(max(0.0, 1.0 - pow(d / radius, 2.0)));
    vec3 sphereColor = vec3(0.008);
    for (int i = 0; i < ${nodeCount}; i++) {
      float ld = length(u_nodes[j] - u_lights[i].xy);
      float emission = 1.0 - smoothstep(0.001, 0.02, ld);
      float reflected = exp(-ld * 14.0) * 0.06 * max(0.0, dot(normalize(delta + vec2(0.0001)), normalize(u_lights[i].xy - u_nodes[j] + vec2(0.0001))));
      sphereColor += (mix(u_colors[i], vec3(1.0), 0.45) * emission * 2.4 + u_colors[i] * reflected) * u_lights[i].z * (0.65 + 0.35 * curvedEdge);
    }
    light = mix(light, sphereColor, disc);
  }
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  light += (grain - 0.5) * 0.003 * smoothstep(0.01, 0.1, length(light));
  float vignette = 1.0 - smoothstep(0.15, 0.65, length(uv));
  gl_FragColor = vec4(vec3(0.019608) + light * vignette, 1.0);
}`;

type FieldProps = { phase: number; playing: boolean; motionAllowed: boolean; replay: number };

export function RightsLightField({ phase, playing, motionAllowed, replay }: FieldProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const fallback = useRef<SVGSVGElement>(null);
  const [renderer, setRenderer] = useState<'svg' | 'webgl'>('svg');
  const scene = useRef({ colors: palettes[0].map(([r, g, b]) => ({ r, g, b })), nodes: layouts[0].map<{ x: number; y: number }>(([x, y]) => ({ x, y })), time: 0, pointer: { x: 0, y: 0, strength: 0 } });
  const draw = useRef<((force?: boolean) => void) | null>(null);
  const preferences = useRef({ playing, motionAllowed, phase });
  preferences.current = { playing, motionAllowed, phase };

  useEffect(() => {
    const target = canvas.current;
    const host = wrapper.current;
    if (!target || !host) return;
    const renderFallback = () => {
      const circles = fallback.current?.querySelectorAll('circle');
      scene.current.nodes.forEach((node, index) => {
        const circle = circles?.[index];
        if (!circle) return;
        const { r, g, b } = scene.current.colors[index];
        circle.setAttribute('cx', String(node.x));
        circle.setAttribute('cy', String(-node.y));
        circle.setAttribute('fill', `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`);
      });
    };
    draw.current = renderFallback;
    renderFallback();
    const gl = target.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return () => { draw.current = null; };
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source); gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) { gl!.deleteShader(shader); return null; }
      return shader;
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); return; }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'a_position');
    const uniforms = Object.fromEntries(['resolution', 'focus', 'nodes', 'lights', 'colors'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const nodes = new Float32Array(nodeCount * 2), lights = new Float32Array(nodeCount * 3), colors = new Float32Array(nodeCount * 3);
    let frame = 0, lastTime = 0, lastDraw = 0, visible = true, disposed = false;
    const render = (force = false) => {
      renderFallback();
      if (disposed || gl.isContextLost()) return;
      const now = performance.now();
      if (!force && now - lastDraw < 32) return;
      lastDraw = now;
      const state = scene.current;
      state.nodes.forEach((node, index) => { nodes[index * 2] = node.x; nodes[index * 2 + 1] = node.y; });
      state.nodes.forEach((node, i) => {
        const distance = (node.x - state.pointer.x) ** 2 + (node.y - state.pointer.y) ** 2;
        const ambient = .38 + .24 * Math.sin(state.time * .8 + i * .65) ** 2;
        const focused = .015 + 1.1 * Math.exp(-distance / .0012);
        lights.set([node.x, node.y, ambient * (1 - state.pointer.strength) + focused * state.pointer.strength], i * 3);
        const color = state.colors[i];
        colors.set([color.r, color.g, color.b], i * 3);
      });
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uniforms.resolution, target.width, target.height);
      gl.uniform1f(uniforms.focus, state.pointer.strength);
      gl.uniform2fv(uniforms.nodes, nodes); gl.uniform3fv(uniforms.lights, lights); gl.uniform3fv(uniforms.colors, colors);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw.current = render;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    const resize = () => {
      // Native desktop resolution and up to 2x on Retina/mobile displays.
      // Bound total pixels rather than stretching a 960px image across the hero.
      const rect = host.getBoundingClientRect();
      const area = Math.max(rect.width * rect.height, 1);
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(4_000_000 / area),
        maxTextureSize / Math.max(rect.width, rect.height, 1),
      );
      target.width = Math.max(1, Math.round(rect.width * ratio)); target.height = Math.max(1, Math.round(rect.height * ratio));
      gl.viewport(0, 0, target.width, target.height); render(true);
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || !preferences.current.playing || !preferences.current.motionAllowed || disposed) { lastTime = 0; return; }
      if (lastTime) scene.current.time += Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      render();
      frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!frame && visible && !document.hidden && preferences.current.playing && preferences.current.motionAllowed) frame = requestAnimationFrame(tick); };
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; } });
    intersection.observe(host);
    const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; } else start(); };
    document.addEventListener('visibilitychange', onVisibility);
    // A custom event resumes the frame loop after the React pause control changes.
    host.addEventListener('rights-render', start);
    const onLoss = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; setRenderer('svg'); };
    target.addEventListener('webglcontextlost', onLoss);
    setRenderer('webgl'); render(true); start();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); host.removeEventListener('rights-render', start);
      target.removeEventListener('webglcontextlost', onLoss); draw.current = null;
      gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    };
  }, []);

  useEffect(() => {
    wrapper.current?.dispatchEvent(new Event('rights-render'));
    const state = scene.current;
    state.time = 0;
    state.pointer.strength = 0;
    const settle = () => {
      if (wrapper.current) wrapper.current.dataset.transition = 'settled';
      draw.current?.(true);
    };
    const ctx = gsap.context(() => {
      if (!motionAllowed) {
        state.nodes.forEach((node, index) => {
          [node.x, node.y] = layouts[phase][index];
          [state.colors[index].r, state.colors[index].g, state.colors[index].b] = palettes[phase][index];
        });
        settle();
        return;
      }
      if (wrapper.current) wrapper.current.dataset.transition = 'morphing';
      draw.current?.(true);
      const transition = gsap.timeline({ onUpdate: () => draw.current?.(), onComplete: settle });
      state.nodes.forEach((node, index) => {
        const [x, y] = layouts[phase][index];
        const [r, g, b] = palettes[phase][index];
        const offset = index * .018;
        transition.to(node, { x, y, duration: 1.45, ease: 'power3.inOut' }, offset);
        transition.to(state.colors[index], { r, g, b, duration: 1.2, ease: 'power2.inOut' }, offset);
      });
    });
    return () => ctx.kill();
  }, [phase, motionAllowed, replay]);

  useEffect(() => { wrapper.current?.dispatchEvent(new Event('rights-render')); }, [playing, motionAllowed]);

  return <div className="light-field" ref={wrapper} data-renderer={renderer} data-phase={phase} data-nodes={nodeCount} data-shape={shapes[phase]} onPointerMove={event => {
    if (!playing || !motionAllowed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current.pointer = { x: (event.clientX - rect.left - rect.width / 2) / rect.height, y: -(event.clientY - rect.top - rect.height / 2) / rect.height, strength: 1 };
    draw.current?.(true);
  }} onPointerLeave={() => { scene.current.pointer.strength = 0; draw.current?.(true); }} aria-hidden="true">
    <canvas ref={canvas} />
    <svg ref={fallback} className="light-field-fallback" viewBox="-0.5 -0.5 1 1" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="fallback-light"><stop stopColor="#acefda" stopOpacity=".3" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs><ellipse rx=".38" ry=".34" fill="url(#fallback-light)" />{layouts[0].map(([x,y], index) => <circle key={index} cx={x} cy={-y} r=".014" fill={`rgb(${palettes[0][index].map(value => Math.round(value * 255)).join(',')})`} />)}</svg>
  </div>;
}
