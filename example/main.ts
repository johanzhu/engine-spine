import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import dat from "dat.gui";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);
const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// CDN 图片链接（你替换成自己的）
const clearImg = "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*2SJaS6BppXYAAAAAAAAAAAAAesp6AQ/original";
const blurImg = "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*YXJITIqlWbMAAAAAAAAAAAAAesp6AQ/original";

// 使用内置的RGB格式避免纹理问题
const clearTex = new THREE.TextureLoader().load(clearImg, (t) => {
  render();
});
const blurTex = new THREE.TextureLoader().load(blurImg, (t) => {
  render();
});

const material = new THREE.ShaderMaterial({
  uniforms: {
    u_clearTex: { value: clearTex },
    u_blurTex: { value: blurTex },
    u_start: { value: new THREE.Vector2(0.3, 0.3) },
    u_end: { value: new THREE.Vector2(0.7, 0.7) },
    u_halfAngle: { value: Math.PI / 8 }, // 调整为更大的锥角
    u_softness: { value: 0.5 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: `
    varying vec2 v_uv;
    void main() {
      v_uv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    varying vec2 v_uv;

    uniform sampler2D u_clearTex;
    uniform sampler2D u_blurTex;
    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_halfAngle;
    uniform float u_softness;

    void main() {
      vec2 dir = u_end - u_start;
      float len = length(dir);
      vec2 normDir = normalize(dir);
      vec2 fragToStart = v_uv - u_start;
      
      float proj = dot(fragToStart, normDir);
      float normalizedProj = clamp(proj / len, 0.0, 1.0);
      
      // 计算距离中心线的距离
      vec2 projPoint = u_start + normDir * proj;
      float dist = length(v_uv - projPoint);
      
      // 计算当前允许的最大偏移
      float maxDist = proj * tan(u_halfAngle);
      
      // 计算混合因子
      float blend = smoothstep(maxDist * (1.0 - u_softness), maxDist, dist);
      blend = mix(blend, normalizedProj, 0.5);
      
      if (proj >= 0.0 && proj <= len && dist <= maxDist) {
        vec4 sharp = texture2D(u_clearTex, v_uv);
        vec4 blur = texture2D(u_blurTex, v_uv);
        gl_FragColor = mix(sharp, blur, blend);
      } else {
        gl_FragColor = vec4(0.0); // 区域外为黑色
      }
    }
  `,
  transparent: true
});

// 使用全屏平面并确保面向相机
const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 40, 40), material);
plane.position.z = -0.1; // 稍微后移避免深度冲突
scene.add(plane);

function render() {
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// 添加GUI调试
const gui = new dat.GUI();
gui.add(material.uniforms.u_start.value, "x", 0, 1).name("Start X");
gui.add(material.uniforms.u_start.value, "y", 0, 1).name("Start Y");
gui.add(material.uniforms.u_end.value, "x", 0, 1).name("End X");
gui.add(material.uniforms.u_end.value, "y", 0, 1).name("End Y");
gui.add(material.uniforms.u_halfAngle, "value", 0, Math.PI / 2).name("Cone Angle");
gui.add(material.uniforms.u_softness, "value", 0, 1).name("Softness");
