import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// The reference keeps ten spheres in a 1 / 2 / 3 / 4 triangle.
// Product stages change illumination, never the reference's silhouette.
const triangle = [[0, .10], [-.034, .04], [.034, .04], [-.068, -.02], [0, -.02], [.068, -.02], [-.102, -.08], [-.034, -.08], [.034, -.08], [.102, -.08]] as const;
const palettes = [
  triangle.map(() => [1, 1, 1]),
  [[.85,.3,1], [1,.18,.65], [.55,.45,1], [1,.16,.4], [.8,.55,1], [.2,.7,1], [1,.45,.48], [.85,1,.8], [.3,1,.9], [.1,.8,1]],
  [[.65,1,.85], [.45,.8,.6], [.8,.6,1], [.3,1,.75], [.7,1,.9], [.6,.45,1], [.55,1,.7], [.85,1,.9], [.3,.85,1], [.7,.65,1]],
];

const vertexSource = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

// Screen-space area-light transport with spherical occlusion and soft shadows.
// All ten spheres can emit; pointer proximity isolates a light as in the video.
const fragmentSource = `precision highp float;
uniform vec2 u_resolution;
uniform float u_focus;
uniform vec2 u_nodes[10];
uniform vec3 u_lights[10];
uniform vec3 u_colors[10];
float visibility(vec2 pixel, vec2 source) {
  vec2 ray = pixel - source;
  float rayLength = length(ray);
  vec2 direction = ray / max(rayLength, 0.0001);
  float result = 1.0;
  for (int j = 0; j < 10; j++) {
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
  for (int i = 0; i < 10; i++) {
    vec2 source = u_lights[i].xy;
    float power = u_lights[i].z;
    float d = length(uv - source);
    float diffuse = exp(-d * 9.0) * (0.055 + 0.13 * u_focus) + exp(-d * 5.0) * 0.035 * u_focus;
    float bloom = exp(-d * 85.0) * 0.33;
    light += u_colors[i] * power * (diffuse * visibility(uv, source) + bloom);
  }
  for (int j = 0; j < 10; j++) {
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
    for (int i = 0; i < 10; i++) {
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
  const [renderer, setRenderer] = useState<'svg' | 'webgl'>('svg');
  const scene = useRef({ colors: palettes[0].map(([r, g, b]) => ({ r, g, b })), nodes: triangle.map<{ x: number; y: number }>(([x, y]) => ({ x, y })), time: 0, pointer: { x: 0, y: 0, strength: 0 } });
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
    const uniforms = Object.fromEntries(['resolution', 'focus', 'nodes', 'lights', 'colors'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const nodes = new Float32Array(20), lights = new Float32Array(30), colors = new Float32Array(30);
    let frame = 0, lastTime = 0, lastDraw = 0, visible = true, disposed = false;
    const render = () => {
      if (disposed || gl.isContextLost()) return;
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
    const onLoss = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; setRenderer('svg'); };
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
    state.time = 0;
    state.pointer.strength = 0;
    const ctx = gsap.context(() => {
      if (!motionAllowed) {
        state.colors.forEach((color, index) => {
          [color.r, color.g, color.b] = palettes[phase][index];
        });
        draw.current?.();
        return;
      }
      const transition = gsap.timeline({ onUpdate: () => draw.current?.() });
      state.colors.forEach((color, index) => {
        const [r, g, b] = palettes[phase][index];
        transition.to(color, { r, g, b, duration: 1.2, ease: 'power2.inOut' }, 0);
      });
    });
    return () => ctx.kill();
  }, [phase, motionAllowed, replay]);

  useEffect(() => { wrapper.current?.dispatchEvent(new Event('rights-render')); }, [playing, motionAllowed]);

  return <div className="light-field" ref={wrapper} data-renderer={renderer} data-phase={phase} data-nodes="10" onPointerMove={event => {
    if (!playing || !motionAllowed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current.pointer = { x: (event.clientX - rect.left - rect.width / 2) / rect.height, y: -(event.clientY - rect.top - rect.height / 2) / rect.height, strength: 1 };
    draw.current?.();
  }} onPointerLeave={() => { scene.current.pointer.strength = 0; draw.current?.(); }} aria-hidden="true">
    <canvas ref={canvas} />
    <svg className="light-field-fallback" viewBox="-0.6 -0.5 1.2 1" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="fallback-light"><stop stopColor="#acefda" stopOpacity=".3" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs><ellipse rx=".38" ry=".34" fill="url(#fallback-light)" />{triangle.map(([x,y], index) => <circle key={index} cx={x} cy={-y} r=".014" fill={phase === 0 ? '#eeeeee' : index % 3 === 0 ? '#e6fff1' : index % 3 === 1 ? '#a191ea' : '#94e9ce'} />)}</svg>
  </div>;
}
