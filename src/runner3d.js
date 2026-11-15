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
      const B = {};
      ["Hips","Spine","Spine1","Spine2","Neck","Head","LeftShoulder","RightShoulder","LeftArm","RightArm","LeftForeArm","RightForeArm",
       "LeftHand","RightHand","LeftUpLeg","RightUpLeg","LeftLeg","RightLeg","LeftFoot","RightFoot"].forEach((n) => { B[n] = bone(model, "mixamorig:"+n); });
      // The mixer only writes a bone when its value changes, so our nudges would pile up on a still pose.
      // Keep each bone's clean pose (as the clips left it), put it back before the mixer runs, re-save after.
      const BASE = Object.keys(B).filter((n) => B[n]).map((n) => [B[n], B[n].quaternion.clone()]);
      const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();

      /* ---- Little bits of life, all in code (no extra clips or files).
         We nudge bones after the clip has posed him, rotating about the hall's own axes so it works on
         any Mixamo-style rig: he turns to look at you on hover, hops when clicked, and after a while
         standing still he fidgets (Spider-Man 2000 style). Idles are short (under 5s) and stop after
         three, so motion never runs on by itself for long (WCAG 2.2.2). */
      const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), va = new THREE.Vector3();
      const UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(), FWD = new THREE.Vector3();
      const camLocal = new THREE.Vector3();
      function turn(b, axis, ang){
        // rotate bone b by ang about a world axis
        if(!b || !ang) return;
        b.parent.updateWorldMatrix(true, false);
        b.parent.getWorldQuaternion(qp).invert();
        va.copy(axis).applyQuaternion(qp).normalize();
        b.quaternion.premultiply(qa.setFromAxisAngle(va, ang));
        b.updateMatrixWorld(true);
      }
      const ease = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t*t*(3 - 2*t);
      const env = (t, a, b) => ease(t / a) * (1 - ease((t - (1 - b)) / b));   // rise over a, fall over the last b (t in 0..1)
      const L = { look: 0, lookTo: 0, peek: 0, hop: -1, idle: null, idleT: 0, still: 0, next: 10, count: 0, last: -1 };
      const IDLES = [
        { d: 3.4, f(t, k){   // look around: one way, then the other
          const y = (ease((t - .05)/.2) - ease((t - .45)/.2) * 1.8 + ease((t - .8)/.15) * 0.8) * 0.75 * k;
          turn(B.Neck, UP, y*0.45); turn(B.Head, UP, y*0.55);
        }},
        { d: 3.0, f(t, k){   // check the watch on the left wrist
          const e = env(t, .22, .25) * k;
          turn(B.LeftArm, SIDE, -0.45*e); turn(B.LeftArm, FWD, -0.15*e);
          turn(B.LeftForeArm, SIDE, -1.55*e); turn(B.LeftForeArm, UP, -0.9*e);
          turn(B.Neck, SIDE, 0.2*e); turn(B.Head, SIDE, 0.3*e); turn(B.Head, UP, 0.35*e);
        }},
        { d: 3.0, f(t, k){   // stretch, arms up
          const e = env(t, .3, .3) * k;
          turn(B.Spine1, SIDE, -0.12*e); turn(B.Head, SIDE, -0.25*e);
          turn(B.LeftArm, FWD, 2.5*e); turn(B.RightArm, FWD, -2.5*e);
          turn(B.LeftForeArm, FWD, 0.3*e); turn(B.RightForeArm, FWD, -0.3*e);
        }},
        { d: 2.6, f(t, k){   // tap the right foot
          const e = env(t, .1, .15) * k, tap = Math.abs(Math.sin(t * this.d * Math.PI * 2.6));
          turn(B.RightFoot, SIDE, -0.38*tap*e); turn(B.Head, SIDE, 0.06*tap*e);
        }},
        { d: 2.0, f(t, k){   // shrug, twice
          const e = Math.pow(Math.sin(Math.min(1, t/.9) * Math.PI * 2), 2) * k * (t < .9 ? 1 : 0);
          turn(B.LeftShoulder, FWD, 0.28*e); turn(B.RightShoulder, FWD, -0.28*e); turn(B.Head, SIDE, -0.06*e);
        }}
      ];
      function life(st){
        const dt = st.dt, calm = 1 - Math.min(1, st.amp * 1.5);     // fades out as he gets moving
        holder.updateMatrixWorld(true);
        SIDE.set(1, 0, 0).applyQuaternion(holder.quaternion);
        FWD.set(0, 0, 1).applyQuaternion(holder.quaternion);
        // look at the camera (hover, or briefly after a tap)
        L.peek = Math.max(0, L.peek - dt);
        const want = (L.lookTo || L.peek > 0) ? 1 : 0;
        L.look += (want - L.look) * Math.min(1, dt * (st.reduce ? 60 : 5));
        // idles: after 10s still, up to three, 10-14s apart
        if(st.still < 0.5){ L.still = 0; L.next = 10; L.count = 0; if(L.idle) L.idle = null; }
        else L.still += dt;
        if(!st.reduce && !L.idle && L.count < 3 && L.still > L.next && L.look < 0.05 && L.hop < 0){
          let i; do{ i = Math.floor(Math.random() * IDLES.length); }while(i === L.last && IDLES.length > 1);
          L.idle = IDLES[i]; L.last = i; L.idleT = 0; L.count++;
        }
        let key = "";
        if(L.look > 0.002){
          camLocal.copy(camera.position);
          camera.matrix.decompose(camLocal, qp, va);
          holder.worldToLocal(camLocal);
          const yaw = THREE.MathUtils.clamp(Math.atan2(camLocal.x, camLocal.z), -1.35, 1.35) * L.look * calm;
          turn(B.Spine, UP, yaw*0.12); turn(B.Spine1, UP, yaw*0.18); turn(B.Spine2, UP, yaw*0.2);
          turn(B.Neck, UP, yaw*0.22); turn(B.Head, UP, yaw*0.28);
          turn(B.Head, SIDE, -0.06 * L.look * calm);
          key += "l" + L.look.toFixed(3);
        }
        if(L.idle){
          L.idleT += dt;
          const t = L.idleT / L.idle.d;
          if(t >= 1){ L.idle = null; L.next = L.still + 10 + Math.random() * 4; }
          else { L.idle.f(t, calm); key += "i" + L.idleT.toFixed(3); }
        }
        let lift = 0;
        if(L.hop >= 0){
          L.hop += dt;
          const h = L.hop, D = 0.62;
          if(h >= D){ L.hop = -1; }
          else {
            // crouch, spring up, land soft
            const c = h < .14 ? Math.sin(h/.14 * Math.PI/2) : h < .2 ? 1 - (h - .14)/.06 : h > .48 ? Math.sin(Math.min(1, (h - .48)/.14) * Math.PI) * 0.7 : 0;
            const air = h > .17 && h < .5 ? Math.sin((h - .17)/.33 * Math.PI) : 0;
            const crouch = c * calm, tuck = air * 0.5;
            ["Left", "Right"].forEach((s) => {
              turn(B[s+"UpLeg"], SIDE, -(0.55*crouch + 0.5*tuck)); turn(B[s+"Leg"], SIDE, 1.0*crouch + 0.9*tuck); turn(B[s+"Foot"], SIDE, -0.45*crouch);
            });
            turn(B.Spine1, SIDE, 0.18*crouch);
            turn(B.LeftArm, FWD, 0.5*air); turn(B.RightArm, FWD, -0.5*air);
            lift = air * 26 - crouch * 9;
            key += "h" + h.toFixed(3);
          }
        }
        holder.position.y = lift;
        return key;
      }

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

      let lastDark = null, lastW = 0, lastH = 0;
      const RED = opts.look === "concrete";
      if(RED) renderer.toneMapping = THREE.NoToneMapping;
      // His colour is the design system's `runner` token (CSS var --runner), read whenever the theme flips.
      const tint = new THREE.Color(), WHITE = new THREE.Color(0xffffff);
      function theme(dark){
        if(dark === lastDark) return; lastDark = dark;
        let v = getComputedStyle(document.documentElement).getPropertyValue("--runner").trim();
        try{ tint.setStyle(v || (RED ? "#ff2a1c" : dark ? "#b9b5ad" : "#2a2926")); }catch(e){ tint.set(RED ? 0xff2a1c : 0x777777); }
        if(RED){
          // a figure made of red light: emissive so it reads as the source, not lit by the room
          body.color.copy(tint).multiplyScalar(0.69); body.emissive.copy(tint); body.emissiveIntensity = 0.85; body.roughness = 0.5;
          joints.color.copy(tint).multiplyScalar(0.54); joints.emissive.copy(tint); joints.emissiveIntensity = 0.7;
        } else {
          body.color.copy(tint);
          joints.color.copy(tint); if(dark) joints.color.multiplyScalar(0.76); else joints.color.lerp(WHITE, 0.2);
          renderer.toneMappingExposure = dark ? 0.8 : 1.0;
        }
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
          BASE.forEach((r) => r[0].quaternion.copy(r[1]));
          mixer.update(0);
          pin();
          BASE.forEach((r) => r[1].copy(r[0].quaternion));
          holder.position.set(st.x, 0, st.z);
          holder.rotation.y = Math.PI/2 - st.faceA;
          const lifeKey = life(st);

          // nothing moved (idle has settled, or reduced motion): keep the last frame
          const c = st.cam;
          const key = [c.C[0], c.C[1], c.C[2], c.r[0], c.r[2], c.u[1], c.f, c.cx, c.cy, st.W, st.H, st.x, st.faceA,
            wI, wW, wR, phase, idleT, st.dark, lifeKey].map((n) => typeof n === "number" ? n.toFixed(3) : n).join(",");
          if(key === lastKey) return;
          lastKey = key;
          setCamera(c, st.W, st.H); lastW = st.W; lastH = st.H;
          renderer.render(scene, camera);
        },
        dispose(){ renderer.dispose(); },
        look(on){ L.lookTo = on ? 1 : 0; },
        peek(){ L.peek = 1.6; L.idle = null; },   // a tap: look over for a moment (the click hop was cut, 2026-11-15)
        // is the screen point over him? (a padded box around his head and feet, as last drawn)
        hit(x, y){
          if(!lastW) return false;
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          [B.Head, B.LeftFoot, B.RightFoot, B.LeftHand, B.RightHand, B.Hips].forEach((b) => {
            if(!b) return; b.getWorldPosition(va).project(camera);
            const sx = (va.x + 1)/2 * lastW, sy = (1 - va.y)/2 * lastH;
            x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
          });
          const pad = Math.max(14, (y1 - y0) * 0.12);
          return x >= Math.min(x0, x1 - 0) - pad && x <= x1 + pad && y >= y0 - pad*1.6 && y <= y1 + pad*0.5;
        }
      };
      if(/r3debug/.test(location.search)){
        const rf = bone(model, "mixamorig:RightFoot"), fv = new THREE.Vector3();
        window.__r3 = { W, R, L, IDLES, feet(){ return [foot, rf].map((b) => { b.getWorldPosition(fv); return [fv.x, fv.y]; }); } };
      }
      resolve(api);
    }, undefined, reject);
  });
}

window.createRunner3D = createRunner;
