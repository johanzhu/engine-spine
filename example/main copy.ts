import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "dat.gui";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const loader = new THREE.TextureLoader();
loader.crossOrigin = "anonymous";

// 顶点着色器：保持原有弯曲与旋转效果
const vertexShader = `
uniform float uBendFactor;
uniform float uWaveSpeed;
uniform float uFlipOriginY;
uniform float uPageRotation;
uniform float uTime;
void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // 直接使用uFlipOriginY的连续值（移除1.0/0.0判断）
    vec2 flipOrigin = vec2(1.0, 1.5 - 3.0 * uFlipOriginY);
    float distance = length(modelPosition.xy - flipOrigin);
    
    // 使用纯指数衰减计算弯曲强度
    float decay = exp(-distance * uWaveSpeed);
    float effectiveBend = uBendFactor * decay;
    
    // 弯曲变形：保持左侧边 x=-1 固定
    if (effectiveBend > 0.0) { // 原为 0.0
        float radius = 1.0 / (effectiveBend);
        float angle = (modelPosition.x + 1.0) * effectiveBend;
        modelPosition.x = -1.0 + radius * sin(angle);
        modelPosition.z = radius * (1.0 - cos(angle));
    }
    
    // 额外旋转：绕左侧边（x = -1）旋转，
    // 在 xz 平面内以 pivot = (-1, 0) 为中心旋转
    vec3 pos = modelPosition.xyz;
    vec2 pivot = vec2(-1.0, 0.0);
    vec2 xz = pos.xz - pivot;
    float cosR = cos(uPageRotation);
    float sinR = sin(uPageRotation);
    vec2 rotatedXZ = vec2(xz.x * cosR - xz.y * sinR, xz.x * sinR + xz.y * cosR);
    pos.xz = rotatedXZ + pivot;
    modelPosition = vec4(pos, 1.0);
    
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

const fragmentShader = `
void main() {
    gl_FragColor = vec4(0.9, 0.8, 0.6, 1.0);
}
`;

const material = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader,
  fragmentShader,
  uniforms: {
    uBendFactor: { value: 0.0 },
    uWaveSpeed: { value: 0.15 },
    uFlipOriginY: { value: 0.0 },
    uPageRotation: { value: 0.0 },
    uTime: { value: 0 }
  }
});

const geometry = new THREE.PlaneGeometry(2, 3, 40, 40);
const page = new THREE.Mesh(geometry, material);
scene.add(page);

const gui = new dat.GUI();
const params = {
  bendAngle: 0,
  waveSpeed: 0.5,
  flipOrigin: 0,
  pageRotation: 0
};
gui
  .add(params, "bendAngle", 0, 2.0 * Math.PI)
  .step(0.01)
  .name("弯曲角度")
  .onChange((value) => {
    material.uniforms.uBendFactor.value = value;
    console.log(value);
  });
gui
  .add(params, "waveSpeed", 0, 1)
  .step(0.01)
  .name("波动速度")
  .onChange((value) => {
    material.uniforms.uWaveSpeed.value = value;
  });
gui
  .add(params, "flipOrigin", 0, 1)
  .step(0.01)
  .name("起始点位置")
  .onChange((value) => {
    material.uniforms.uFlipOriginY.value = value;
  });
gui
  .add(params, "pageRotation", -Math.PI, Math.PI)
  .step(0.01)
  .name("页面旋转")
  .onChange((value) => {
    material.uniforms.uPageRotation.value = value;
  });

// smoothStep 实现：在 edge0 到 edge1 之间平滑过渡
function smoothStep(edge0, edge1, x) {
  let t = Math.max(0, Math.min((x - edge0) / (edge1 - edge0), 1));
  return t * t * (3 - 2 * t);
}

// 调整参数
const maxPageRotation = Math.PI / 2; // 最大旋转 90°
const bendSpeed = 0.005; // 拖拽转换为弯曲的比例
const maxBend = 1.5; // 最大弯曲值

// 新增变量：保存累积的弯曲状态
let accumulatedBend = 0; // 上一次 touchend 后的弯曲值
let initialBend = 0; // 本次 touchstart 时的基准弯曲值
let targetRotation = 0;
let currentRotation = 0;

let isTouching = false;
let touchStartX = 0;

// 新增过渡控制变量
let currentFlipOriginY = 0;
let targetFlipOriginY = 0;

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    isTouching = true;
    touchStartX = e.touches[0].clientX;
    // 使用上一次的累积状态作为本次的初始弯曲值
    initialBend = accumulatedBend;
    controls.enabled = false;
  }
});

// 修改touchmove事件处理
canvas.addEventListener("touchmove", (e) => {
  if (isTouching && e.touches.length === 1) {
    const currentX = e.touches[0].clientX;
    const deltaX = touchStartX - currentX;
    let newBend = initialBend + deltaX * bendSpeed;
    newBend = Math.max(0, Math.min(newBend, maxBend));
    material.uniforms.uBendFactor.value = newBend;
    params.bendAngle = newBend;

    let ratio = newBend / maxBend;
    targetRotation = maxPageRotation * smoothStep(0.8, 1.0, ratio);

    const touchY = e.touches[0].clientY;
    const screenHeight = window.innerHeight;
    targetFlipOriginY = touchY < screenHeight / 2 ? 0 : 1;

    gui.updateDisplay();
  }
});

canvas.addEventListener("touchend", (e) => {
  isTouching = false;
  controls.enabled = true;
  // 保存本次翻页结束时的弯曲状态，作为下次 touchstart 的基准
  accumulatedBend = material.uniforms.uBendFactor.value;
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  material.uniforms.uTime.value = clock.getElapsedTime();
  controls.update();

  // 对旋转角度进行平滑缓动
  currentRotation = THREE.MathUtils.lerp(currentRotation, targetRotation, 0.2);
  material.uniforms.uPageRotation.value = currentRotation;
  params.pageRotation = currentRotation;

  // 添加起始点过渡动画
  currentFlipOriginY = THREE.MathUtils.lerp(
    currentFlipOriginY,
    targetFlipOriginY,
    0.2 // 控制过渡速度
  );

  material.uniforms.uFlipOriginY.value = currentFlipOriginY;
  params.flipOrigin = currentFlipOriginY;

  renderer.render(scene, camera);
}
animate();
