import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "dat.gui";

// 基础场景设置
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

// 定义所有页面贴图（每张贴图代表一页）
const texturePaths = [
  "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*YXJITIqlWbMAAAAAAAAAAAAAesp6AQ/original",
  "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*B2NYSb3PYvcAAAAAAAAAAAAAesp6AQ/original",
  "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*2SJaS6BppXYAAAAAAAAAAAAAesp6AQ/original",
  "https://mdn.alipayobjects.com/huamei_kz4wfo/afts/img/A*khMkRYSP2ywAAAAAAAAAAAAAesp6AQ/original"
];
const textures = texturePaths.map((path) => loader.load(path));

// --- Shader 代码 ---
// 顶点着色器保持原有翻页效果，不做正负区分
const vertexShader = `
uniform float uBendFactor;
uniform float uWaveSpeed;
uniform float uFlipOriginY;
uniform float uPageRotation;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    
    // 固定左侧边 x=-1 作为翻页基准
    vec2 flipOrigin = vec2(1.0, 1.5 - 3.0 * uFlipOriginY);
    float distance = length(modelPosition.xy - flipOrigin);
    
    float decay = exp(-distance * uWaveSpeed);
    float effectiveBend = uBendFactor * decay;
    
    if (effectiveBend > 0.0) {
        float radius = 1.0 / effectiveBend;
        float angle = (modelPosition.x + 1.0) * effectiveBend;
        modelPosition.x = -1.0 + radius * sin(angle);
        modelPosition.z = radius * (1.0 - cos(angle));
        
        // 绕左侧边 (-1, 0) 旋转
        vec3 pos = modelPosition.xyz;
        vec2 pivot = vec2(-1.0, 0.0);
        vec2 xz = pos.xz - pivot;
        float cosR = cos(uPageRotation);
        float sinR = sin(uPageRotation);
        vec2 rotatedXZ = vec2(xz.x * cosR - xz.y * sinR, xz.x * sinR + xz.y * cosR);
        pos.xz = rotatedXZ + pivot;
        modelPosition = vec4(pos, 1.0);
    }
    
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

// 片元着色器采样传入贴图
const fragmentShader = `
uniform sampler2D uTexture;
varying vec2 vUv;
void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    gl_FragColor = texColor;
}
`;

// --- 创建页面 Mesh ---
// 共用同一几何体
const geometry = new THREE.PlaneGeometry(2, 3, 40, 40);
// pages 数组保存所有页面
const pages = [];
const numPages = textures.length;
class PageAnimator {
  constructor() {
    this.animations = new Map();
  }
  addAnimation(page, targetBend, targetRotation, duration = 0.4) {
    this.animations.set(page, {
      startBend: page.material.uniforms.uBendFactor.value,
      targetBend,
      startRotation: page.material.uniforms.uPageRotation.value,
      targetRotation,
      startTime: performance.now(),
      duration
    });
  }
  update() {
    const now = performance.now();
    for (const [page, anim] of this.animations) {
      const t = Math.min((now - anim.startTime) / (anim.duration * 1000), 1);

      page.material.uniforms.uBendFactor.value = THREE.MathUtils.lerp(anim.startBend, anim.targetBend, t);
      page.material.uniforms.uPageRotation.value = THREE.MathUtils.lerp(anim.startRotation, anim.targetRotation, t);
      if (t === 1) this.animations.delete(page);
    }
  }
}
const animator = new PageAnimator();

// dat.GUI 调试面板（仅调试翻页时使用的公共参数）
const gui = new dat.GUI();
const params = {
  bendAngle: 0,
  waveSpeed: 0.5,
  flipOrigin: 0,
  pageRotation: 0
};
gui
  .add(params, "bendAngle", 0, Math.PI * 2)
  .step(0.01)
  .name("弯曲角度");
gui.add(params, "waveSpeed", 0, 1).step(0.01).name("波动速度");
gui.add(params, "flipOrigin", 0, 1).step(0.01).name("起始点位置");
gui.add(params, "pageRotation", 0, Math.PI).step(0.01).name("页面旋转");

// smoothStep 函数（与原逻辑相同）
function smoothStep(edge0, edge1, x) {
  let t = Math.max(0, Math.min((x - edge0) / (edge1 - edge0), 1));
  return t * t * (3 - 2 * t);
}

// --- 翻页参数及状态 ---
const maxPageRotation = Math.PI / 2; // 最大旋转 90°
const bendSpeed = 0.005; // 拖拽转化为弯曲的比例
const maxBend = 1.5; // 最大弯曲值

// --- 初始化页面 ---
let currentPageIndex = numPages - 1; // 初始显示最后一页

for (let i = 0; i < numPages; i++) {
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader,
    fragmentShader,
    uniforms: {
      uBendFactor: { value: i < currentPageIndex ? maxBend : 0 },
      uWaveSpeed: { value: 0.15 },
      uFlipOriginY: { value: 0.0 },
      uPageRotation: { value: i < currentPageIndex ? maxPageRotation : 0 },
      uTexture: { value: textures[i] }
    }
  });
  const pageMesh = new THREE.Mesh(geometry, material);
  pageMesh.position.z = -i * 0.01;
  pages.push(pageMesh);
  scene.add(pageMesh);
}

let activeFlipPage = null;
let initialBend = 0;
let touchStartX = 0;
let flipDirection = null; // "left" 或 "right"
let isTouching = false;
// 新增过渡控制变量
let currentFlipOriginY = 0;
let targetFlipOriginY = 0;

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    controls.enabled = false;
  }
});

canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length === 1) {
    const deltaX = touchStartX - e.touches[0].clientX;
    touchStartX = e.touches[0].clientX;

    if (!activeFlipPage) {
      if (deltaX > 0) {
        // 左滑
        activeFlipPage = pages[currentPageIndex];
        flipDirection = "left";
      } else {
        // 右滑
        // 修正条件：检查前一页是否处于弯曲状态
        if (currentPageIndex > 0 && pages[currentPageIndex - 1].material.uniforms.uBendFactor.value === maxBend) {
          activeFlipPage = pages[currentPageIndex - 1];
          flipDirection = "right";
        }
      }
    }

    if (activeFlipPage) {
      // 修正弯曲计算方向
      const deltaBend = deltaX * bendSpeed; // 移除方向乘数
      let newBend = activeFlipPage.material.uniforms.uBendFactor.value + deltaBend;

      newBend = Math.max(0, Math.min(newBend, maxBend));
      activeFlipPage.material.uniforms.uBendFactor.value = newBend;

      const ratio = newBend / maxBend;
      const targetRotation = maxPageRotation * smoothStep(0.0, 1.0, ratio);
      activeFlipPage.material.uniforms.uPageRotation.value = targetRotation;

      params.bendAngle = newBend;
      params.pageRotation = targetRotation;
      gui.updateDisplay();
    }

    const touchY = e.touches[0].clientY;
    const screenHeight = window.innerHeight;
    targetFlipOriginY = touchY < screenHeight / 2 ? 0 : 1;
  }
});

canvas.addEventListener("touchend", () => {
  controls.enabled = true;
  if (!activeFlipPage) return;
  let targetBend, targetRotation;

  if (flipDirection === "left") {
    const shouldFlip = activeFlipPage.material.uniforms.uBendFactor.value >= maxBend * 0.4;
    targetBend = shouldFlip ? maxBend : 0;
    targetRotation = shouldFlip ? maxPageRotation : 0;

    if (shouldFlip && currentPageIndex < numPages - 1) {
      currentPageIndex++;
      updatePageDepths(); // 调用新函数
    }
  } else {
    // right
    const shouldRestore = activeFlipPage.material.uniforms.uBendFactor.value < maxBend * 0.6;
    targetBend = shouldRestore ? 0 : maxBend;
    targetRotation = shouldRestore ? 0 : maxPageRotation;

    if (shouldRestore && currentPageIndex > 0) {
      currentPageIndex--;
      updatePageDepths(); // 调用新函数
    }
  }
  // 添加动画
  animator.addAnimation(activeFlipPage, targetBend, targetRotation);
  activeFlipPage = null;
});

function animate() {
  requestAnimationFrame(animate);
  animator.update();
  controls.update();
  renderer.render(scene, camera);

  // 添加起始点过渡动画
  currentFlipOriginY = THREE.MathUtils.lerp(
    currentFlipOriginY,
    targetFlipOriginY,
    0.2 // 控制过渡速度
  );
  // 同时更新shader参数和调试面板
  if (activeFlipPage) {
    activeFlipPage.material.uniforms.uFlipOriginY.value = currentFlipOriginY;
    params.flipOrigin = currentFlipOriginY;
  }
}
animate();

function updatePageDepths() {
  pages.forEach((page, i) => {
    let baseZ = -i * 0.01; // 基础层级
    page.position.z = i === currentPageIndex ? baseZ + 0.001 : baseZ;
    page.matrixWorldNeedsUpdate = true; // 强制更新矩阵
  });
}
