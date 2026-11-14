/* A real 3D runner, drawn by Three.js on its own canvas over the CSS hall.
   The hall's camera (scene.js buildCam) is copied into Three.js every frame, so the figure sits
   exactly where the stick figure stood. The figure is a stand-in (Mixamo X Bot with its idle,
   walk and run clips); Suraj's own GLB drops in at models/runner.glb with clips named the same. */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const HEIGHT = 140;          // world units, against a 250 door (the stick figure was 132)

function bone(root, name){
  // GLTFLoader strips ":" from node names, so "mixamorig:LeftFoot" arrives as "mixamorigLeftFoot"
  return root.getObjectByName(name) || root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
}
function pinHips(hips, rest, up){
  // keep the clip's own drift out: hold the hips over the mark, leave the bounce
  if(!hips) return;
  for(let i = 0; i < 3; i++) if(i !== up) hips.position.setComponent(i, rest.getComponent(i));
}
function measure(root, clip, foot, forward, pin){
  // The planted foot slides back at exactly the speed the clip "travels". Measure it only while the
  // foot is on the ground, and note when the foot is furthest forward (heel strike) to align gaits.
  const mixer = new THREE.AnimationMixer(root);
  const act = mixer.clipAction(clip); act.play();
  const v = new THREE.Vector3(), N = 120, dt = clip.duration / N;
  const f = [], y = [];
  for(let i = 0; i < N; i++){
    mixer.setTime(dt * i); pin(); root.updateMatrixWorld(true);
    foot.getWorldPosition(v); f.push(v.dot(forward)); y.push(v.y);
  }
  act.stop(); mixer.uncacheRoot(root);
  const yMin = Math.min(...y), yMax = Math.max(...y), lim = yMin + (yMax - yMin)*0.08;
  const sp = [];
  let fMax = -Infinity, tMax = 0;
  for(let i = 0; i < N; i++){
    if(f[i] > fMax){ fMax = f[i]; tMax = i / N; }
    const j = (i + 1) % N;
    if(y[i] <= lim && y[j] <= lim) sp.push((f[i] - f[j]) / dt);
  }
  sp.sort((a, b) => a - b);
  const speed = sp.length ? sp[sp.length >> 1] : 0;      // model units per second of clip time
  return { speed, start: tMax, dur: clip.duration };
}

export function createRunner(opts){
  const canvas = opts.canvas;
  let renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  }catch(e){ return Promise.reject(e); }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  // soft studio light: key from front-left above, a cool rim from behind
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-300, 600, 500); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.2); rim.position.set(400, 300, -600); scene.add(rim);
  scene.add(key.target, rim.target);

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;

  const body = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.0 });
  const joints = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.0 });

  return new Promise((resolve, reject) => {
    new GLTFLoader().load(opts.url, (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if(o.isSkinnedMesh || o.isMesh){
          o.material = /joint/i.test(o.material && o.material.name || "") ? joints : body;
          o.frustumCulled = false;
        }
      });
      // scale to height, feet on the floor: measure from the skeleton (skinned bounds are unreliable)
      model.updateMatrixWorld(true);
      const box = new THREE.Box3(), bv = new THREE.Vector3();
      model.traverse((o) => { if(o.isBone){ o.getWorldPosition(bv); box.expandByPoint(bv); } });
      const h = box.max.y - box.min.y || 1;
      const s = HEIGHT / h;
      const holder = new THREE.Group();     // placed and turned in the hall
      const inner = new THREE.Group();      // carries the model's own scale
      inner.scale.setScalar(s);
      inner.position.y = -box.min.y * s;
      inner.add(model); holder.add(inner); scene.add(holder);
      key.target = holder; rim.target = holder;

      const clip = (n) => gltf.animations.find((a) => a.name.toLowerCase() === n);
      const C = { idle: clip("idle"), walk: clip("walk"), run: clip("run") };
      if(!C.walk || !C.run){ reject(new Error("runner.glb needs walk and run clips")); return; }

      // measure stride and phase of each gait in the model's own space (it faces +Z)
      const fwd = new THREE.Vector3(0, 0, 1);
      const foot = bone(model, "mixamorig:LeftFoot");
      if(!foot){ reject(new Error("runner.glb needs a LeftFoot bone")); return; }
      const hips = bone(model, "mixamorig:Hips");
      const hipRest = hips ? hips.position.clone() : null;
      let up = 1;
      if(hipRest){ const a = [Math.abs(hipRest.x), Math.abs(hipRest.y), Math.abs(hipRest.z)]; up = a.indexOf(Math.max(...a)); }
      const pin = () => pinHips(hips, hipRest, up);
      const W = measure(model, C.walk, foot, fwd, pin);
      const R = measure(model, C.run, foot, fwd, pin);
      // measured on the scaled model, so these are already hall units per second
      if(!(W.speed > 1 && R.speed > 1)){ reject(new Error("could not measure the stride")); return; }

      const mixer = new THREE.AnimationMixer(model);
      const A = {};
      ["idle", "walk", "run"].forEach((k) => {
        if(!C[k]) return;
        // the hips carry the clip's own drift; keep the figure in place so our spring moves it
        const a = mixer.clipAction(C[k]);
        a.setLoop(THREE.LoopRepeat, Infinity); a.play(); a.setEffectiveWeight(0);
        A[k] = a;
      });

      let phase = 0, idleT = 0, lastKey = "";
      const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();

      function setCamera(c, Wd, Ht){
        // CSS world: x right, y down, z toward the viewer. Three: y up. Flip y on the way in.
        X.set(c.r[0], -c.r[1], c.r[2]);
        Y.set(-c.u[0], c.u[1], -c.u[2]);
        Z.set(c.b[0], -c.b[1], c.b[2]);
        camera.matrix.makeBasis(X, Y, Z).setPosition(c.C[0], -c.C[1], c.C[2]);
        camera.matrixWorldNeedsUpdate = true;
        const n = 10, f = 40000;
        camera.projectionMatrix.set(
          2*c.f/Wd, 0, 1 - 2*c.cx/Wd, 0,
          0, 2*c.f/Ht, 2*c.cy/Ht - 1, 0,
          0, 0, -(f + n)/(f - n), -2*f*n/(f - n),
          0, 0, -1, 0);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }

      let lastDark = null;
      const RED = opts.look === "concrete";
      if(RED){
        // a figure made of red light: emissive so it reads as the source, not lit by the room
        body.color.set(0xb0120a); body.emissive.set(0xff2414); body.emissiveIntensity = 0.85; body.roughness = 0.5;
        joints.color.set(0x8a0d07); joints.emissive.set(0xff1c0e); joints.emissiveIntensity = 0.7;
        renderer.toneMapping = THREE.NoToneMapping;
      }
      function theme(dark){
        if(RED || dark === lastDark) return; lastDark = dark;
        body.color.set(dark ? 0xb9b5ad : 0x2a2926);
        joints.color.set(dark ? 0x8d8982 : 0x55524c);
        renderer.toneMappingExposure = dark ? 0.8 : 1.0;
      }

      const api = {
        resize(Wd, Ht, dpr){ renderer.setPixelRatio(dpr); renderer.setSize(Wd, Ht, false); lastKey = ""; },
        render(st){
          theme(st.dark);
          // gait weights: idle -> walk -> run, the same blend the stick figure used
          const a = st.amp, g = st.gait;
          const wI = 1 - a, wW = a*(1 - g), wR = a*g;
          if(A.idle) A.idle.setEffectiveWeight(wI);
          A.walk.setEffectiveWeight(wW); A.run.setEffectiveWeight(wR);
          // cadence from the stride actually being taken, so the planted foot stays planted
          // playing a clip at rate k moves its planted foot back at k * clip speed; match that to the hall speed
          const sp = st.spd / (1 + 0.15*st.sprint);
          const cyc = THREE.MathUtils.lerp(sp / W.speed / W.dur, sp / R.speed / R.dur, g);
          phase = (phase + Math.min(cyc, 3.4)*st.dt) % 1;
          A.walk.time = ((phase + W.start) % 1) * C.walk.duration;
          A.run.time = ((phase + R.start) % 1) * C.run.duration;
          if(A.idle){ idleT += st.dt * st.idleRate; A.idle.time = idleT % C.idle.duration; }
          mixer.update(0);
          pin();

          holder.position.set(st.x, 0, st.z);
          holder.rotation.y = Math.PI/2 - st.faceA;
          // nothing moved (idle has settled, or reduced motion): keep the last frame
          const c = st.cam;
          const key = [c.C[0], c.C[1], c.C[2], c.r[0], c.r[2], c.u[1], c.f, c.cx, c.cy, st.W, st.H, st.x, st.faceA,
            wI, wW, wR, phase, idleT, st.dark].map((n) => typeof n === "number" ? n.toFixed(3) : n).join(",");
          if(key === lastKey) return;
          lastKey = key;
          setCamera(c, st.W, st.H);
          renderer.render(scene, camera);
        },
        dispose(){ renderer.dispose(); }
      };
      if(/r3debug/.test(location.search)){
        const rf = bone(model, "mixamorig:RightFoot"), fv = new THREE.Vector3();
        window.__r3 = { W, R, feet(){ return [foot, rf].map((b) => { b.getWorldPosition(fv); return [fv.x, fv.y]; }); } };
      }
      resolve(api);
    }, undefined, reject);
  });
}

window.createRunner3D = createRunner;
