import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Anchor, Waves, ChevronRight, Shield, Satellite, Radio } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Animated Earth Sphere with procedural ocean/land shader            */
/* ------------------------------------------------------------------ */
function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Simple hash-based noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 6; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv;
          
          // Create continent-like landmasses using noise
          float continent = fbm(uv * 4.0 + vec2(0.5, 0.2));
          continent += 0.3 * fbm(uv * 8.0 + vec2(1.5, 3.2));
          
          // Ocean color (deep navy to teal)
          vec3 oceanDeep = vec3(0.01, 0.04, 0.12);
          vec3 oceanShallow = vec3(0.0, 0.15, 0.25);
          vec3 ocean = mix(oceanDeep, oceanShallow, fbm(uv * 12.0 + uTime * 0.02));
          
          // Land color (dark greens/browns)
          vec3 landLow = vec3(0.04, 0.12, 0.03);
          vec3 landHigh = vec3(0.08, 0.06, 0.04);
          vec3 land = mix(landLow, landHigh, fbm(uv * 16.0));
          
          // Determine land vs ocean
          float landMask = smoothstep(0.48, 0.55, continent);
          vec3 surface = mix(ocean, land, landMask);
          
          // City lights on dark side
          float lights = step(0.52, continent) * fbm(uv * 32.0);
          vec3 cityLights = vec3(1.0, 0.85, 0.4) * lights * 0.6;
          
          // Lighting
          vec3 lightDir = normalize(vec3(1.0, 0.5, 0.8));
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          float ambient = 0.08;
          
          // Dark side gets city lights
          float darkSide = 1.0 - smoothstep(0.0, 0.15, diffuse);
          surface = surface * (ambient + diffuse * 0.9) + cityLights * darkSide;
          
          // Atmosphere rim
          float fresnel = pow(1.0 - max(dot(vNormal, normalize(-vPosition)), 0.0), 3.0);
          vec3 atmosColor = vec3(0.15, 0.5, 1.0);
          surface += atmosColor * fresnel * 0.4;
          
          // Cloud layer
          float clouds = fbm(uv * 6.0 + vec2(uTime * 0.01, uTime * 0.005));
          clouds = smoothstep(0.45, 0.7, clouds) * 0.3;
          surface = mix(surface, vec3(0.8, 0.85, 0.9), clouds * diffuse);
          
          gl_FragColor = vec4(surface, 1.0);
        }
      `,
    });
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0015;
      earthMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += 0.0015;
    }
  });

  return (
    <group>
      {/* Earth */}
      <mesh ref={meshRef} material={earthMaterial}>
        <sphereGeometry args={[2.2, 128, 128]} />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.06}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
              gl_FragColor = vec4(0.1, 0.5, 1.0, intensity * 0.6);
            }
          `}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating particle ring around Earth                                */
/* ------------------------------------------------------------------ */
function OrbitRing() {
  const ref = useRef<THREE.Points>(null);
  const count = 300;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 3.2 + (Math.random() - 0.5) * 0.3;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);

  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.002;
  });

  return (
    <points ref={ref} rotation={[0.3, 0, 0.1]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#00D4FF" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing Page Component                                             */
/* ------------------------------------------------------------------ */
interface LandingProps {
  onEnter: () => void;
}

export function Landing({ onEnter }: LandingProps) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#020810]">
      {/* 3D Canvas — fullscreen background */}
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.05} />
          <directionalLight position={[5, 3, 5]} intensity={0.8} />
          <Stars radius={100} depth={60} count={3000} factor={4} saturation={0} fade speed={0.5} />
          <Earth />
          <OrbitRing />
        </Canvas>
      </div>

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,8,16,0.85)_70%,rgba(2,8,16,0.98)_100%)]" />

      {/* Scan-line effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.15) 2px, rgba(0,212,255,0.15) 3px)',
        }}
      />

      {/* Content overlay */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        {/* Top nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-2.5">
            <Waves className="text-[#00D4FF]" size={22} />
            <span className="text-lg font-semibold tracking-tight text-white">
              Sagar<span className="text-[#00D4FF]">Drishti</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/40 tracking-wider uppercase">
            <span>Maritime Intelligence</span>
            <span className="w-px h-3 bg-white/10" />
            <span>Real-Time Surveillance</span>
          </div>
        </div>

        {/* Hero content */}
        <div className="text-center max-w-3xl space-y-8 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-dim/60 bg-[rgba(0,212,255,0.06)]">
            <Shield size={13} className="text-[#00D4FF]" />
            <span className="text-[0.7rem] font-medium tracking-widest uppercase text-[#00D4FF]">
              Maritime Oil Spill Intelligence Platform
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight">
            <span className="text-white">Protecting Our</span>
            <br />
            <span className="bg-gradient-to-r from-[#00D4FF] via-[#00B4D8] to-[#0077B6] bg-clip-text text-transparent">
              Oceans with AI
            </span>
          </h1>

          {/* Description */}
          <p className="text-base md:text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Real-time satellite SAR oil spill detection, 10,000+ vessel AIS tracking,
            dark-vessel attribution, and reverse-drift origin reconstruction
            powered by U-Net++ deep learning.
          </p>

          {/* Feature pills */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: Satellite, label: 'Sentinel-1 SAR' },
              { icon: Radio, label: '10K+ AIS Vessels' },
              { icon: Anchor, label: 'Anomaly Detection' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] text-white/40 text-xs"
              >
                <Icon size={12} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Enter button */}
          <div className="pt-4">
            <button
              onClick={onEnter}
              className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-xl
                bg-gradient-to-r from-[#00D4FF] to-[#0077B6]
                text-white font-semibold text-sm tracking-wide
                shadow-[0_0_40px_rgba(0,212,255,0.3)]
                hover:shadow-[0_0_60px_rgba(0,212,255,0.5)]
                hover:scale-[1.03]
                transition-all duration-300"
            >
              Enter Command Center
              <ChevronRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-xl border border-[#00D4FF]/30 animate-ping opacity-20" />
            </button>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-10">
          {[
            { value: '10,001', label: 'Vessels Tracked' },
            { value: '99.7 MB', label: 'U-Net++ Model' },
            { value: '<2s', label: 'Detection Latency' },
            { value: '6', label: 'SAR Regions' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-semibold text-white/80">{value}</div>
              <div className="text-[0.6rem] text-white/30 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
