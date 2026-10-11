import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Shared by the GPU scene and its SVG fallback. Units are relative to canvas height.
const layouts = [
  [[0, .18], [-.047, .096], [.047, .096], [-.094, .012], [0, .012], [.094, .012], [-.141, -.072], [-.047, -.072], [.047, -.072], [.141, -.072], [0, -.13], [0, -.048]],
  [[-.092, .14], [-.035, .14], [.035, .14], [.092, .14], [-.14, .045], [-.07, .045], [0, .045], [.07, .045], [-.092, -.05], [-.035, -.05], [.035, -.05], [.092, -.05]],
  [[-.1, .16], [-.1, .07], [-.1, -.02], [-.1, -.11], [-.025, .16], [.05, .14], [.095, .085], [.07, .02], [-.025, -.005], [.018, -.065], [.065, -.12], [.112, -.175]],
] as const;

const vertexSource = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

// Analytic screen-space light transport: dark spheres occlude each emitter,
// producing the moving, soft radial shadows seen in the supplied video.
const fragmentSource = `precision mediump float;
uniform vec2 u_resolution;
uniform vec2 u_nodes[12];
uniform vec3 u_lights[4];
uniform vec3 u_colors[4];
float visibility(vec2 pixel, vec2 source) {
  vec2 ray = pixel - source;
  float rayLength = length(ray);
  vec2 direction = ray / max(rayLength, 0.0001);
  float result = 1.0;
  for (int j = 0; j < 12; j++) {
    vec2 delta = u_nodes[j] - source;
    float along = dot(delta, direction);
    float perpendicular = abs(delta.x * direction.y - delta.y * direction.x);
    if (along > 0.025 && along < rayLength) {
      float penumbra = 0.007 + along * 0.024;
      result *= smoothstep(0.012 - penumbra, 0.017 + penumbra, perpendicular);
    }
  }
  return result;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.y;
  vec3 light = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 source = u_lights[i].xy;
    float power = u_lights[i].z;
    if (power < 0.01) continue;
    float d = length(uv - source);
    float glow = exp(-d * 7.0) * 0.17 + exp(-d * 20.0) * 0.08;
    float bloom = exp(-d * 105.0) * 0.47;
    light += u_colors[i] * power * (glow * visibility(uv, source) + bloom);
  }
  for (int j = 0; j < 12; j++) {
    vec2 delta = uv - u_nodes[j];
    float d = length(delta);
    if (d > 0.0142) continue;
    float disc = 1.0 - smoothstep(0.0108, 0.0142, d);
    vec3 sphereColor = vec3(0.018);
    float curvedEdge = sqrt(max(0.0, 1.0 - pow(d / 0.014, 2.0)));
    for (int i = 0; i < 4; i++) {
      float ld = length(u_nodes[j] - u_lights[i].xy);
      float emission = 1.0 - smoothstep(0.001, 0.025, ld);
      float reflected = exp(-ld * 11.0) * 0.17 * max(0.0, dot(normalize(delta + vec2(0.0001)), normalize(u_lights[i].xy - u_nodes[j] + vec2(0.0001))));
      sphereColor += (mix(u_colors[i], vec3(1.0), 0.77) * emission * 1.9 + u_colors[i] * reflected) * u_lights[i].z * (0.55 + 0.45 * curvedEdge);
    }
    light = mix(light, sphereColor, disc);
  }
  // Gentle film grain keeps the light from looking like a flat CSS gradient.
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  light += (grain - 0.5) * 0.004 * smoothstep(0.01, 0.1, length(light));
  float vignette = 1.0 - smoothstep(0.22, 0.8, length(uv));
  gl_FragColor = vec4(vec3(0.019608) + light * vignette, 1.0);
}`;

type FieldProps = { phase: number; playing: boolean; motionAllowed: boolean; replay: number };

export function RightsLightField({ phase, playing, motionAllowed, replay }: FieldProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<'svg' | 'webgl'>('svg');
  const scene = useRef({ nodes: layouts[0].map<{ x: number; y: number }>(([x, y]) => ({ x, y })), time: 0, pointer: { x: 0, y: 0, strength: 0 } });
  const draw = useRef<(() => void) | null>(null);
  const preferences = useRef({ playing, motionAllowed, phase });
  preferences.current = { playing, motionAllowed, phase };

  useEffect(() => {
    const target = canvas.current;
    const host = wrapper.current;
    if (!target || !host) return;
    const gl = target.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
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
    const uniforms = Object.fromEntries(['resolution', 'nodes', 'lights', 'colors'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const nodes = new Float32Array(24), lights = new Float32Array(12), colors = new Float32Array(12);
    let frame = 0, lastTime = 0, lastDraw = 0, visible = true, disposed = false;
    const render = () => {
      if (disposed || gl.isContextLost()) return;
      const state = scene.current;
      const prefs = preferences.current;
      state.nodes.forEach((node, index) => { nodes[index * 2] = node.x; nodes[index * 2 + 1] = node.y; });
      const indices = [0, 6, 11];
      const palette = prefs.phase === 0 ? [[.6,1,.65], [1,1,1], [.4,.9,.65]] : prefs.phase === 1 ? [[1,.18,.78], [.25,.56,1], [.15,1,.85]] : [[.45,1,.7], [.7,.34,1], [.6,.85,1]];
      indices.forEach((index, i) => {
        lights[i*3] = state.nodes[index].x; lights[i*3+1] = state.nodes[index].y;
        lights[i*3+2] = .55 + .45 * Math.sin(state.time * .85 + i * 2.1) ** 2;
        colors.set(palette[i], i * 3);
      });
      // The pointer illuminates the closest recorded node rather than following as a blob.
      let closest = 0, distance = Infinity;
      state.nodes.forEach((node, index) => { const d = (node.x - state.pointer.x) ** 2 + (node.y - state.pointer.y) ** 2; if (d < distance) { closest = index; distance = d; } });
      lights.set([state.nodes[closest].x, state.nodes[closest].y, state.pointer.strength * .85], 9);
      colors.set([.8,.9,1], 9);
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uniforms.resolution, target.width, target.height);
      gl.uniform2fv(uniforms.nodes, nodes); gl.uniform3fv(uniforms.lights, lights); gl.uniform3fv(uniforms.colors, colors);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    draw.current = render;
    const resize = () => {
      // Bound GPU work, including on high-DPI phones.
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1, 720 / Math.max(rect.width, 1));
      target.width = Math.max(1, Math.round(rect.width * ratio)); target.height = Math.max(1, Math.round(rect.height * ratio));
      gl.viewport(0, 0, target.width, target.height); render();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const tick = (now: number) => {
      frame = 0;
      if (!visible || document.hidden || !preferences.current.playing || !preferences.current.motionAllowed || disposed) { lastTime = 0; return; }
      if (lastTime) scene.current.time += Math.min((now - lastTime) / 1000, .05);
      lastTime = now;
      if (now - lastDraw > 32) { render(); lastDraw = now; }
      frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!frame && visible && !document.hidden && preferences.current.playing && preferences.current.motionAllowed) frame = requestAnimationFrame(tick); };
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; } });
    intersection.observe(host);
    const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; } else start(); };
    document.addEventListener('visibilitychange', onVisibility);
    // A custom event resumes the frame loop after the React pause control changes.
    host.addEventListener('rights-render', start);
    const onLoss = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); setRenderer('svg'); };
    target.addEventListener('webglcontextlost', onLoss);
    setRenderer('webgl'); start();
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
    const ctx = gsap.context(() => {
      if (!motionAllowed) {
        state.nodes.forEach((node, index) => { node.x = layouts[phase][index][0]; node.y = layouts[phase][index][1]; });
        draw.current?.();
        return;
      }
      const transition = gsap.timeline({ onUpdate: () => draw.current?.() });
      state.nodes.forEach((node, index) => transition.to(node, { x: layouts[phase][index][0], y: layouts[phase][index][1], duration: 1.6, ease: 'power3.inOut' }, index * .018));
    });
    return () => ctx.kill();
  }, [phase, motionAllowed, replay]);

  useEffect(() => { wrapper.current?.dispatchEvent(new Event('rights-render')); }, [playing, motionAllowed]);

  return <div className="light-field" ref={wrapper} data-renderer={renderer} data-phase={phase} onPointerMove={event => {
    if (!playing || !motionAllowed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current.pointer = { x: (event.clientX - rect.left - rect.width / 2) / rect.height, y: -(event.clientY - rect.top - rect.height / 2) / rect.height, strength: 1 };
  }} onPointerLeave={() => { scene.current.pointer.strength = 0; }} aria-hidden="true">
    <canvas ref={canvas} />
    <svg className="light-field-fallback" viewBox="-0.6 -0.4 1.2 0.8"><defs><radialGradient id="fallback-light"><stop stopColor="#acefda" stopOpacity=".3" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs><ellipse rx=".38" ry=".34" fill="url(#fallback-light)" />{layouts[phase].map(([x,y], index) => <circle key={index} cx={x} cy={-y} r=".012" fill={index % 3 === 0 ? '#e6fff1' : index % 3 === 1 ? '#a191ea' : '#94e9ce'} />)}</svg>
  </div>;
}
