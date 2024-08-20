import * as THREE from 'three';
import * as spine from "@esotericsoftware/spine-threejs";

let scene, camera, renderer;
let skeletonMesh;
let assetManager;
let canvas;
let lastFrameTime = Date.now() / 1000;

let skeletonFile = "spineboy-pro.json";
let atlasFile = "/spineboy-pma.atlas";

function init() {
  let width = window.innerWidth,
  height = window.innerHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
  camera.position.z = 2000;
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas'), devicePixelRatio: 1 });
  renderer.setSize(width, height);
  document.body.appendChild(renderer.domElement);
  canvas = renderer.domElement;
  assetManager = new spine.AssetManager();
  assetManager.loadText(skeletonFile);
  assetManager.loadTextureAtlas(atlasFile);

  requestAnimationFrame(load);
}

function load(name, scale) {
  if (assetManager.isLoadingComplete()) {
    const atlas = assetManager.require(atlasFile);
    const atlasLoader = new spine.AtlasAttachmentLoader(atlas);
    let skeletonJson = new spine.SkeletonJson(atlasLoader);
    skeletonJson.scale = 1;
    let skeletonData = skeletonJson.readSkeletonData(
      assetManager.require(skeletonFile)
    );
    skeletonMesh = new spine.SkeletonMesh(
      skeletonData,
      (parameters) => {
        parameters.depthTest = true;
        parameters.depthWrite = true;
        parameters.alphaTest = 0.001;
      }
    );
    scene.add(skeletonMesh);

    requestAnimationFrame(render);
  } else requestAnimationFrame(load);
}

let lastTime = Date.now();
function render() {
  let now = Date.now() / 1000;
  let delta = now - lastFrameTime;
  lastFrameTime = now;
  resize();
  skeletonMesh.update(delta);
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

function resize() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (canvas.width != w || canvas.height != h) {
    canvas.width = w;
    canvas.height = h;
  }

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}

init();